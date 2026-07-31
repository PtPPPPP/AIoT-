interface ImportMetaEnv {
  readonly VITE_RUNTIME_MODE?: string;
  readonly VITE_EDGE_NODE_TYPE?: string;
  readonly VITE_EDGE_NODE_NAME?: string;
  readonly VITE_EDGE_API_BASE_URL?: string;
  readonly VITE_EDGE_AI_PROVIDER?: string;
  readonly VITE_EDGE_AI_ENABLED?: string;
  readonly VITE_EDGE_WS_URL?: string;
  readonly VITE_EDGE_DATA_TRANSPORT?: string;
  readonly VITE_EDGE_POLL_INTERVAL_MS?: string;
  readonly VITE_EDGE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_EDGE_STALE_AFTER_MS?: string;
}

interface ImportMeta { readonly env: ImportMetaEnv; }
