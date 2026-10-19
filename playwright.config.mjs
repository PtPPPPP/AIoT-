import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined, headless: true, viewport: { width: 1440, height: 1000 } },
  projects: [
    { name: 'dev', testIgnore: /runtime-external/, use: { baseURL: 'http://127.0.0.1:5173' } },
    { name: 'external-mock', testMatch: /runtime-external/, use: { baseURL: 'http://127.0.0.1:5174' } },
    { name: 'offline', testIgnore: /runtime-external/, use: { baseURL: `file:///${process.cwd().replace(/\\/g, '/')}/dist/` } },
  ],
  webServer: [
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: false, timeout: 30_000, env: { VITE_RUNTIME_MODE: 'simulation', VITE_EDGE_API_BASE_URL: '', VITE_EDGE_AI_PROVIDER: 'simulation', VITE_EDGE_AI_ENABLED: 'false' } },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 30_000, env: { VITE_RUNTIME_MODE: 'external', VITE_EDGE_API_BASE_URL: 'http://mock-gateway.invalid', VITE_EDGE_AI_PROVIDER: 'disabled', VITE_EDGE_AI_ENABLED: 'false', VITE_EDGE_STALE_AFTER_MS: '1500', VITE_EDGE_POLL_INTERVAL_MS: '500' } },
  ],
});
