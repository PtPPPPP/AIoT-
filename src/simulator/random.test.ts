import { randomSequence, seedToState } from './random';

describe('seeded random source', () => {
  it('produces the same sequence for the same seed', () => {
    const state = seedToState('答辩-种子-A');
    expect(randomSequence(state, 5)).toEqual(randomSequence(state, 5));
  });

  it('produces a different sequence for a different seed', () => {
    expect(randomSequence(seedToState('答辩-种子-A'), 5).values)
      .not.toEqual(randomSequence(seedToState('答辩-种子-B'), 5).values);
  });
});
