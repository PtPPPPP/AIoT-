import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: { browserName: 'chromium', headless: true, viewport: { width: 1440, height: 1000 } },
  projects: [
    { name: 'dev', use: { baseURL: 'http://127.0.0.1:5173' } },
    { name: 'offline', use: { baseURL: `file:///${process.cwd().replace(/\\/g, '/')}/dist/` } },
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30_000 },
});
