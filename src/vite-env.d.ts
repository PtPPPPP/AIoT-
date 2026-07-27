interface ImportMetaEnv {
  readonly VITE_RUNTIME_MODE?: string;
  readonly VITE_EDGE_API_BASE_URL?: string;
  readonly VITE_EDGE_WS_URL?: string;
  readonly VITE_EDGE_DATA_TRANSPORT?: string;
  readonly VITE_EDGE_POLL_INTERVAL_MS?: string;
  readonly VITE_EDGE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_EDGE_STALE_AFTER_MS?: string;
}

interface ImportMeta { readonly env: ImportMetaEnv; }
