import { RuntimeMode } from '../types';

export type RuntimeConfig = {
  mode: RuntimeMode;
  edgeApiBaseUrl?: string;
  edgeWsUrl?: string;
  dataTransport: 'http-polling' | 'websocket';
  pollIntervalMs: number;
  requestTimeoutMs: number;
  staleAfterMs: number;
  warnings: string[];
};
type RuntimeEnv = { VITE_RUNTIME_MODE?: string; VITE_EDGE_API_BASE_URL?: string; VITE_EDGE_WS_URL?: string; VITE_EDGE_DATA_TRANSPORT?: string; VITE_EDGE_POLL_INTERVAL_MS?: string; VITE_EDGE_REQUEST_TIMEOUT_MS?: string; VITE_EDGE_STALE_AFTER_MS?: string };

const defaults = { pollIntervalMs: 1_000, requestTimeoutMs: 3_000, staleAfterMs: 5_000 };
const modes: RuntimeMode[] = ['simulation', 'external', 'playback'];

function readNumber(value: string | undefined, fallback: number, name: string, warnings: string[]) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 60_000) {
    if (value !== undefined) warnings.push(`${name} 无效，已使用安全默认值 ${fallback}ms。`);
    return fallback;
  }
  return Math.round(parsed);
}

function readUrl(value: string | undefined, name: string, warnings: string[]) {
  if (!value) return undefined;
  try { return new URL(value).toString().replace(/\/$/, ''); }
  catch { warnings.push(`${name} 不是合法 URL，已忽略。`); return undefined; }
}

export function createRuntimeConfig(env: RuntimeEnv = import.meta.env): RuntimeConfig {
  const warnings: string[] = [];
  const mode = modes.includes(env.VITE_RUNTIME_MODE as RuntimeMode) ? env.VITE_RUNTIME_MODE as RuntimeMode : 'simulation';
  if (env.VITE_RUNTIME_MODE && mode === 'simulation' && env.VITE_RUNTIME_MODE !== 'simulation') warnings.push('VITE_RUNTIME_MODE 无效，已使用 simulation。');
  const dataTransport = env.VITE_EDGE_DATA_TRANSPORT === 'websocket' ? 'websocket' : 'http-polling';
  if (env.VITE_EDGE_DATA_TRANSPORT && !['http-polling', 'websocket'].includes(env.VITE_EDGE_DATA_TRANSPORT)) warnings.push('VITE_EDGE_DATA_TRANSPORT 无效，已使用 http-polling。');
  return {
    mode,
    edgeApiBaseUrl: readUrl(env.VITE_EDGE_API_BASE_URL, 'VITE_EDGE_API_BASE_URL', warnings),
    edgeWsUrl: readUrl(env.VITE_EDGE_WS_URL, 'VITE_EDGE_WS_URL', warnings),
    dataTransport,
    pollIntervalMs: readNumber(env.VITE_EDGE_POLL_INTERVAL_MS, defaults.pollIntervalMs, 'VITE_EDGE_POLL_INTERVAL_MS', warnings),
    requestTimeoutMs: readNumber(env.VITE_EDGE_REQUEST_TIMEOUT_MS, defaults.requestTimeoutMs, 'VITE_EDGE_REQUEST_TIMEOUT_MS', warnings),
    staleAfterMs: readNumber(env.VITE_EDGE_STALE_AFTER_MS, defaults.staleAfterMs, 'VITE_EDGE_STALE_AFTER_MS', warnings),
    warnings,
  };
}

export const runtimeConfig = createRuntimeConfig();
export function isExternalConfigured(config: RuntimeConfig) { return Boolean(config.edgeApiBaseUrl); }
