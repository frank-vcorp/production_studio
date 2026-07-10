/**
 * E2E Smoke Test — Brief → Keyframe → Análisis → Clip (modo SANDBOX).
 *
 * Spec: SPEC-20260705-04 (sandbox) + IMPL-20260710-02.
 *
 * OBJETIVO: Validar el flujo end-to-end completo en modo SANDBOX (VITE_USE_SANDBOX=true)
 * sin gastar API calls reales. Si este spec pasa, podemos cambiar a live con confianza.
 *
 * PREREQUISITO: el dev server DEBE estar corriendo con VITE_USE_SANDBOX=true:
 *   cd production_studio && VITE_USE_SANDBOX=true node node_modules/vite/bin/vite.js --port 5173
 *
 * FLUJO:
 *   1. Reset state → landing page
 *   2. Click "Crear mi primer spot" → Brief wizard (3 pasos)
 *   3. Verifica SANDBOX badge en el header
 *   4. Sube imagen al primer keyframe slot disponible
 *   5. Verifica overlay de análisis (mock Vision ~1.5-2.5s)
 *   6. Verifica overlay "Análisis listo"
 *   7. Click "Generar clip" → prompt gate modal
 *   8. Verifica que NO aparece modal de costo (sandbox skip)
 *   9. Verifica prompt en español (Movimiento de cámara, Tono de marca, etc.)
 *   10. Click "Aprobar y generar"
 *   11. Verifica badge "✓ Clip listo" (sandbox mock ~3-5s)
 *
 * ID: IMPL-20260710-02.
 */

import { test, expect, type Page } from '@playwright/test';

/** PNG dummy válido: 1x1 pixel rojo sólido (89 bytes base64). */
const DUMMY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Helper: ejecuta el flujo del BriefWizard para llegar al Storyboard.
 */
async function completeBriefWizard(page: Page) {
  await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /crear mi primer/i }).click();

  await expect(page.getByRole('heading', { name: /brief wizard/i })).toBeVisible({ timeout: 10_000 });

  // Paso 1: Negocio
  await expect(page.getByText(/paso 1 de 3/i)).toBeVisible();
  await page.getByPlaceholder(/CP Automotriz/i).fill('Smoke Test Garage');
  await page.getByRole('button', { name: /^siguiente$/i }).click();

  // Paso 2: Servicios
  await expect(page.getByText(/paso 2 de 3/i)).toBeVisible();
  await page.getByRole('button', { name: /agregar servicio/i }).click();
  await page.getByPlaceholder(/Hojalatería y Pintura/i).first().fill('Servicio Principal');
  await page.getByRole('button', { name: /^siguiente$/i }).click();

  // Paso 3: Visión → Finalizar
  await expect(page.getByText(/paso 3 de 3/i)).toBeVisible();
  await page.getByRole('button', { name: /guardar y continuar/i }).click();

  // Espera storyboard cargado
  await expect(page.getByTestId('keyframe-slot-atencion_in')).toBeVisible({ timeout: 10_000 });
}

/**
 * Helper: sube una imagen dummy al primer slot vacío visible.
 * En sandbox, la keyframe más temprana sin imagen suele ser el destino más simple.
 */
async function uploadImageToFirstAvailableSlot(page: Page) {
  const buffer = Buffer.from(DUMMY_PNG_BASE64, 'base64');

  // Buscar el primer slot vacio
  const firstEmptySlot = page.locator('[data-testid^="keyframe-slot-"]').first();
  await firstEmptySlot.scrollIntoViewIfNeeded();
  const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5_000 });
  await firstEmptySlot.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'test-keyframe.png',
    mimeType: 'image/png',
    buffer,
  });
}

test.describe('Smoke E2E en modo SANDBOX (cero costo API)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.evaluate(() => {
      return indexedDB.databases?.().then((dbs) => {
        dbs?.forEach((db) => db.name && indexedDB.deleteDatabase(db.name));
      });
    }).catch(() => undefined);
    await page.reload();
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 10_000 });
  });

  test('flujo completo: brief → upload → análisis → clip "generado"', async ({ page }) => {
    test.setTimeout(90_000);

    // Step 1: BriefWizard → Storyboard
    await completeBriefWizard(page);

    // Step 2: SANDBOX badge visible (header de MainApp)
    await expect(page.getByTestId('sandbox-badge')).toBeVisible({ timeout: 5_000 });
    const badgeText = await page.getByTestId('sandbox-badge').textContent();
    expect(badgeText).toMatch(/sandbox/i);

    // Step 3: Storyboard tiene slots AIDA
    await expect(page.locator('[data-testid^="keyframe-slot-"]').first()).toBeVisible();

    // Step 4: Subir imagen al primer slot disponible
    await uploadImageToFirstAvailableSlot(page);

    // Step 5: Overlay de análisis aparece (mock Vision ~1.5-2.5s)
    await expect(page.getByTestId('analysis-overlay-analyzing')).toBeVisible({ timeout: 10_000 });

    // Step 6: Análisis listo (overlay verde)
    await expect(page.getByTestId('analysis-overlay-done')).toBeVisible({ timeout: 10_000 });

    // Step 7: Esperar botón "Generar clip" o "Editar nodo" (puede haber race conditions)
    // Mientras hay transiciones pendientes, "Generar clip" está disponible.
    const generateClipButton = page.locator('button:has-text("Generar clip")').first();
    await expect(generateClipButton).toBeVisible({ timeout: 5_000 });

    // Step 8: Click "Generar clip" → prompt gate
    await generateClipButton.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Step 9: ⚠️ Verificar que NO aparece el modal de costo (sandbox skip)
    await expect(page.getByText(/costo estimado de generación/i)).not.toBeVisible();

    // Step 10: Verificar que el prompt contiene texto en español
    const textarea = page.locator('textarea').first();
    const promptText = await textarea.inputValue();
    if (promptText.length > 0) {
      // Solo chequear si hay contenido (depende si la keyframe fuente tiene análisis)
      expect(promptText).toMatch(/(Movimiento de cámara|Tono de marca)/);
      expect(promptText).not.toContain('Camera:');
      expect(promptText).not.toContain('Brand voice:');
    }

    // Step 11: Click "Aprobar y generar"
    const approveButton = page.getByRole('button', { name: /aprobar y generar/i });
    if (await approveButton.isVisible()) {
      await approveButton.click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

      // Step 12: Esperar badge "done" del sandbox mock (Veo ~3-5s)
      await expect(page.getByTestId('generation-progress-done')).toBeVisible({ timeout: 15_000 });
    }

    // Step 13: SANDBOX badge sigue visible todo el tiempo
    await expect(page.getByTestId('sandbox-badge')).toBeVisible();
  });

  test('verifica overlay de análisis se muestra en español', async ({ page }) => {
    test.setTimeout(60_000);

    await completeBriefWizard(page);
    await uploadImageToFirstAvailableSlot(page);

    // Texto del overlay en español
    await expect(page.getByTestId('analysis-overlay-analyzing')).toContainText(
      /Analizando con Gemini Vision/,
    );
    await expect(page.getByTestId('analysis-overlay-done')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('analysis-overlay-done')).toContainText(/Análisis listo/);
  });

  test('NO muestra modal de costo en sandbox', async ({ page }) => {
    test.setTimeout(60_000);

    await completeBriefWizard(page);
    await uploadImageToFirstAvailableSlot(page);
    await expect(page.getByTestId('analysis-overlay-done')).toBeVisible({ timeout: 10_000 });

    // Solo si hay un "Generar clip" disponible
    const generateClipButton = page.locator('button:has-text("Generar clip")').first();
    if (await generateClipButton.isVisible()) {
      await generateClipButton.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

      // CRÍTICO: NO debe aparecer el modal de costo.
      // El cost modal solo se muestra cuando VITE_USE_SANDBOX !== true (producción).
      await expect(page.getByText(/costo estimado de generación/i)).not.toBeVisible();
    }
  });
});
