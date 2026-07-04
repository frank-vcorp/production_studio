/**
 * Playwright config para tests e2e de accesibilidad.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.3.
 *
 * ID: IMPL-20260704-05.
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Solo 1 worker para evitar conflictos con puerto 5173
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});