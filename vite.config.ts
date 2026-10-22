import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'offline' ? './' : '/',
  plugins: [react()],
  define: mode === 'offline' ? {
    'import.meta.env.VITE_DATA_SERVICE_URL': JSON.stringify(''),
    'import.meta.env.VITE_RUNTIME_MODE': JSON.stringify('simulation'),
    'import.meta.env.VITE_EDGE_API_BASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_EDGE_WS_URL': JSON.stringify(''),
    'import.meta.env.VITE_EDGE_AI_PROVIDER': JSON.stringify('simulation'),
    'import.meta.env.VITE_EDGE_AI_ENABLED': JSON.stringify('false'),
  } : undefined,
  build: mode === 'offline' ? {
    cssCodeSplit: false,
    rolldownOptions: { output: { codeSplitting: false } },
  } : undefined,
}));
