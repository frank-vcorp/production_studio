/**
 * E2E a11y audit de BriefWizard con sector automotriz pre-llenado.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.3 — BriefWizard.
 * ID: IMPL-20260704-05.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility: BriefWizard', () => {
  test('BriefWizard con sector automotriz pasa axe-core con 0 violations', async ({ page }) => {
    await page.goto('/');
    // Limpiar localStorage para forzar LandingPage
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();

    // Click en sector automotriz desde LandingPage
    await page.getByTestId('sector-template-automotriz').click();

    // Wizard debe estar visible: header de marca + tabs + main
    await expect(page.locator('header[role="banner"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Audit con axe-core
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});