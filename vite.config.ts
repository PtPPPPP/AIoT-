import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'offline' ? './' : '/',
  plugins: [react()],
  build: mode === 'offline' ? {
    cssCodeSplit: false,
    rolldownOptions: { output: { codeSplitting: false } },
  } : undefined,
}));
