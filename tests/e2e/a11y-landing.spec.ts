/**
 * E2E a11y audit de LandingPage con axe-core.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.3 — LandingPage.
 * ID: IMPL-20260704-05.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility: LandingPage', () => {
  test('LandingPage pasa axe-core con 0 violations', async ({ page }) => {
    // Asegurar que NO hay brief previo (localStorage limpio)
    await page.goto('/');
    await page.evaluate(() => {
      // Resetear stores para mostrar LandingPage
      window.localStorage.removeItem('bridge.hasSeenTour.v1');
    });
    await page.reload();

    // Verificar que la LandingPage está visible
    await expect(page.getByTestId('landing-page')).toBeVisible();

    // Audit con axe-core
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});