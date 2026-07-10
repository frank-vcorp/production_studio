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
  // IMPL-20260710-02: webServer deshabilitado. Correr vite manualmente antes del spec:
  //   cd production_studio && VITE_USE_SANDBOX=true node node_modules/vite/bin/vite.js --port 5173 --strictPort
  // (Razón: dependencia de pnpm global rota, evitamos el wrapper bash del webServer.)
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});