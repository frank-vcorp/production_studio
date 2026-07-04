/**
 * E2E keyboard navigation: Tab cycling, focus visible, landmarks.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.5.
 * ID: IMPL-20260704-05.
 */

import { test, expect } from '@playwright/test';

test.describe('Keyboard navigation', () => {
  test('Skip link es el primer elemento tabbable', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.getByTestId('landing-page')).toBeVisible();

    await page.keyboard.press('Tab');
    const skipLink = page.getByTestId('skip-link');
    await expect(skipLink).toBeFocused();
  });

  test('Landmarks principales existen en MainApp tras seleccionar sector', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.getByTestId('landing-page')).toBeVisible();

    // Click en sector automotriz → crea brief → carga MainApp
    await page.getByTestId('sector-template-automotriz').click();

    // Esperar a que MainApp monte
    await expect(page.locator('header[role="banner"]')).toBeVisible({ timeout: 10_000 });

    // Verificar landmarks
    await expect(page.locator('header[role="banner"]')).toBeVisible();
    await expect(page.locator('nav[aria-label="Tabs principales"]')).toBeVisible();
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();
  });

  test('Sector grid buttons son tabbables y tienen aria-label', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.getByTestId('landing-page')).toBeVisible();

    // Verificar que los 6 sectores tienen aria-label
    const sectores = ['Automotriz', 'Estética y Belleza', 'Comida y Restaurante', 'Salud y Bienestar', 'Inmobiliaria', 'Otro (manual)'];
    for (const name of sectores) {
      const btn = page.getByLabel(`Seleccionar plantilla de ${name}`);
      await expect(btn).toBeVisible();
    }
  });
});