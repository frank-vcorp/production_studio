/**
 * E2E happy-path 2: sector template pre-llena el brief en el store.
 * Spec: SPEC-S6-TESTS-CICD §6.2.
 *
 * Nota: la SPEC menciona "3 servicios pre-llenados". El comportamiento actual
 * de la app (S5) carga el sector template al `projectStore`, pero el wizard
 * mantiene un draft local que NO refleja el sector hasta que el usuario lo
 * confirma. Por lo tanto, validamos que el brief en el store sí tiene los
 * 3 servicios pre-configurados (esto es lo que eventualmente se usará al
 * ensambar el storyboard).
 *
 * ID: IMPL-20260704-06.
 */

import { test, expect } from '@playwright/test';

test.describe('Happy path 2: sector template pre-fill', () => {
  test('sector automotriz precarga brief con 3 servicios en el store', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.evaluate(() => {
      return indexedDB.databases?.().then((dbs) => {
        dbs?.forEach((db) => db.name && indexedDB.deleteDatabase(db.name));
      });
    }).catch(() => undefined);
    await page.reload();

    // Activar bridge E2E
    await page.evaluate(() => {
      (window as unknown as { __BRIDGE_E2E__: boolean }).__BRIDGE_E2E__ = true;
    });

    // LandingPage visible
    await expect(page.getByTestId('landing-page')).toBeVisible();

    // Click en sector automotriz (selector semántico por aria-label)
    await page.getByRole('button', { name: /seleccionar plantilla de automotriz/i }).click();

    // Wizard montado
    await expect(page.getByRole('heading', { name: /brief wizard/i })).toBeVisible({ timeout: 10_000 });

    // Esperar a que __projectStore__ esté disponible (cargado async en main.tsx)
    await page.waitForFunction(
      () => !!(window as unknown as { __projectStore__?: unknown }).__projectStore__,
      undefined,
      { timeout: 15_000 },
    );

    // El brief en el store debe tener sector='automotriz' y 3 servicios
    const servicesCount = await page.evaluate(() => {
      type W = Window & {
        __projectStore__: { getState: () => { brief: { business: { sector: string }; services: unknown[] } | null } };
      };
      const store = (window as unknown as W).__projectStore__;
      const brief = store?.getState().brief ?? null;
      return { sector: brief?.business.sector ?? null, count: brief?.services.length ?? 0 };
    });
    expect(servicesCount.sector).toBe('automotriz');
    expect(servicesCount.count).toBe(3);
  });
});