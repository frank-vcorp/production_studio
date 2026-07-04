/**
 * E2E happy-path 1: usuario nuevo completa el wizard sin sector template.
 * Spec: SPEC-S6-TESTS-CICD §6.2.
 *
 * Verifica el flujo:
 *   LandingPage → "Crear mi primer spot" → BriefWizard (3 pasos) → Storyboard.
 *
 * ID: IMPL-20260704-06.
 */

import { test, expect } from '@playwright/test';

test.describe('Happy path 1: new user onboarding', () => {
  test('completa wizard de 3 pasos y llega al Storyboard', async ({ page }) => {
    // Limpiar estado para forzar LandingPage (usuario nuevo)
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.evaluate(() => {
      // Limpiar también IndexedDB para garantizar reset completo
      return indexedDB.databases?.().then((dbs) => {
        dbs?.forEach((db) => db.name && indexedDB.deleteDatabase(db.name));
      });
    }).catch(() => undefined);
    await page.reload();

    // LandingPage visible
    await expect(page.getByTestId('landing-page')).toBeVisible();

    // CTA principal "Crear mi primer spot"
    await page.getByRole('button', { name: /crear mi primer/i }).click();

    // BriefWizard visible
    await expect(page.getByRole('heading', { name: /brief wizard/i })).toBeVisible({ timeout: 10_000 });

    // ── Paso 0: Negocio ──
    await expect(page.getByText(/paso 1 de 3/i)).toBeVisible();
    await page.getByRole('tab', { name: /negocio/i }).waitFor({ state: 'visible' });

    // Llenar nombre comercial (campo required)
    const businessName = page.getByPlaceholder(/CP Automotriz/i);
    await businessName.fill('Mi Negocio E2E');

    // Siguiente
    await page.getByRole('button', { name: /^siguiente$/i }).click();

    // ── Paso 1: Servicios ──
    await expect(page.getByText(/paso 2 de 3/i)).toBeVisible();
    await page.getByRole('button', { name: /agregar servicio/i }).click();

    // Llenar nombre del primer servicio
    await page.getByPlaceholder(/Hojalatería y Pintura/i).first().fill('Servicio Principal');

    // Siguiente
    await page.getByRole('button', { name: /^siguiente$/i }).click();

    // ── Paso 2: Visión ──
    await expect(page.getByText(/paso 3 de 3/i)).toBeVisible();

    // Finalizar (botón cambia texto en último paso)
    await page.getByRole('button', { name: /guardar y continuar/i }).click();

    // Toast de éxito
    await expect(page.getByText(/brief guardado/i)).toBeVisible({ timeout: 5_000 });

    // Storyboard visible (KeyframeStoryboard) — keyframe slots del AIDA chain
    await expect(page.getByTestId('keyframe-slot-atencion_in')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('keyframe-slot-accion_in')).toBeVisible();

    // Header refleja el nombre del negocio
    await expect(page.getByRole('banner').getByText(/mi negocio e2e/i)).toBeVisible();
  });
});