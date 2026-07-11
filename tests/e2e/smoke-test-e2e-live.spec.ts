/**
 * E2E Smoke Test LIVE — Brief → Keyframe → Análisis → Clip (PRODUCCIÓN).
 *
 * Spec: IMPL-20260710-03.
 *
 * OBJETIVO: Validar el flujo completo contra la app desplegada en Vercel
 *           usando la API real de Gemini (después de cargar saldo de AI Studio).
 *
 * ⚠️ IMPORTANTE — USO DE API REAL:
 *   - Vision: ~$0.005 USD
 *   - Veo 3.1 (1 clip): ~$0.40 USD
 *   - TOTAL: ~$0.50 USD por corrida completa del spec
 *   - Solo correr UNA vez (idempotencia). NO incluir en CI hasta tener un flag de presupuesto.
 *
 * PREREQUISITOS:
 *   - Gemini AI Studio billing recargado (ya verificado por smoke con curl).
 *   - Vercel deploy con VITE_USE_SANDBOX=false (producción real).
 *   - NO hay webServer local; corre contra https://production-studio-gamma.vercel.app.
 *
 * DIFERENCIAS con smoke-test-e2e-sandbox.spec.ts:
 *   - NO aparece el sandbox badge (es producción).
 *   - SÍ aparece el modal de costo pre-generación.
 *   - Latencias de Vision (5-10s) y Veo (60-180s) son las reales.
 *   - El botón del cost modal dice "Aprobar y gastar" (no "Aprobar y generar").
 *   - Solo se genera UN clip para minimizar costo.
 *
 * ID: IMPL-20260710-03.
 */

import { test, expect, type Page } from '@playwright/test';

const DUMMY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function completeBriefWizard(page: Page) {
  await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /crear mi primer/i }).click();

  await expect(page.getByRole('heading', { name: /brief wizard/i })).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText(/paso 1 de 3/i)).toBeVisible();
  await page.getByPlaceholder(/CP Automotriz/i).fill('Smoke Test Live');
  await page.getByRole('button', { name: /^siguiente$/i }).click();

  await expect(page.getByText(/paso 2 de 3/i)).toBeVisible();
  await page.getByRole('button', { name: /agregar servicio/i }).click();
  await page.getByPlaceholder(/Hojalatería y Pintura/i).first().fill('Servicio Live');
  await page.getByRole('button', { name: /^siguiente$/i }).click();

  await expect(page.getByText(/paso 3 de 3/i)).toBeVisible();
  await page.getByRole('button', { name: /guardar y continuar/i }).click();

  await expect(page.getByTestId('keyframe-slot-atencion_in')).toBeVisible({ timeout: 30_000 });
}

async function uploadImageToFirstAvailableSlot(page: Page) {
  const buffer = Buffer.from(DUMMY_PNG_BASE64, 'base64');
  const firstEmptySlot = page.locator('[data-testid^="keyframe-slot-"]').first();
  await firstEmptySlot.scrollIntoViewIfNeeded();
  const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5_000 });
  await firstEmptySlot.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'test-keyframe-live.png',
    mimeType: 'image/png',
    buffer,
  });
}

test.describe('Smoke E2E LIVE contra Vercel (API real, costo ~$0.50 USD)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.evaluate(() => {
      return indexedDB.databases?.().then((dbs) => {
        dbs?.forEach((db) => db.name && indexedDB.deleteDatabase(db.name));
      });
    }).catch(() => undefined);
    await page.reload();
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 30_000 });
  });

  test('flujo live: brief → imagen → análisis Vision real → modal costo → 1 clip Veo real', async ({ page }) => {
    test.setTimeout(300_000); // 5 min para Vision + Veo polling.

    // ⚠️ En PRODUCCIÓN, NO debe haber sandbox badge
    await expect(page.getByTestId('sandbox-badge')).not.toBeVisible();

    // Step 1: BriefWizard
    await completeBriefWizard(page);

    // Step 2: Storyboard cargado
    await expect(page.locator('[data-testid^="keyframe-slot-"]').first()).toBeVisible();

    // Step 3: Subir imagen
    await uploadImageToFirstAvailableSlot(page);

    // Step 4: Overlay de análisis (Vision real, 5-10s típico)
    await expect(page.getByTestId('analysis-overlay-analyzing')).toBeVisible({ timeout: 30_000 });

    // Step 5: Análisis listo
    await expect(page.getByTestId('analysis-overlay-done')).toBeVisible({ timeout: 60_000 });

    // Step 6: Botón "Generar clip"
    const generateClipButton = page.locator('button:has-text("Generar clip")').first();
    await expect(generateClipButton).toBeVisible({ timeout: 5_000 });
    await generateClipButton.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Step 7: Click "Aprobar y generar" (botón principal del prompt gate)
    await page.getByRole('button', { name: /aprobar y generar/i }).click();

    // Step 8: ⚠️ En PRODUCCIÓN, SÍ debe aparecer el modal de costo (después del click)
    await expect(page.getByText(/costo estimado de generación/i)).toBeVisible({ timeout: 5_000 });

    // Step 9: Click "Aprobar y gastar" (botón DENTRO del cost modal)
    await page.getByRole('button', { name: /aprobar y gastar/i }).click();

    // Step 9: Modal se cierra
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // Step 10: ⚠️ Esperar el overlay de Veo real (60-180s típico, hasta 5 min timeout)
    // Como es API real, puede tardar más que el sandbox (~3s).
    await expect(page.getByTestId('generation-progress-done')).toBeVisible({ timeout: 240_000 });

    // Step 11: Verificar que el badge "Editar nodo" está visible (clipe generado)
    await expect(page.locator('button:has-text("Editar nodo")').first()).toBeVisible({ timeout: 5_000 });

    // Step 12: Verificar toast verde de éxito
    await expect(page.getByText(/video generado|clip listo/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
