export type RandomSequence = {
  values: number[];
  nextState: number;
};

/** Converts a user-visible seed into a stable unsigned 32-bit state. */
export function seedToState(seed: string): number {
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0 || 1;
}

export function nextRandom(state: number): { value: number; nextState: number } {
  let nextState = state >>> 0;
  nextState = (nextState + 0x6D2B79F5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296, nextState };
}

export function randomSequence(state: number, count: number): RandomSequence {
  const values: number[] = [];
  let nextState = state;
  for (let index = 0; index < count; index += 1) {
    const next = nextRandom(nextState);
    values.push(next.value);
    nextState = next.nextState;
  }
  return { values, nextState };
}

export function createSeed(): string {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
    return values[0].toString(36).toUpperCase();
  }
  return Date.now().toString(36).toUpperCase();
}
