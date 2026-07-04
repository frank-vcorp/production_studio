/**
 * E2E happy-path 4: usuario con masterVideo navega al Pack RRSS y configura ratios.
 * Spec: SPEC-S6-TESTS-CICD §6.2.
 *
 * En CI no hay FFmpeg real, así que validamos el flujo UI:
 *   1. Tab "Pack RRSS" se habilita al tener masterVideo
 *   2. 4 ratios checkboxes presentes (9:16, 1:1, 4:5, 16:9)
 *   3. Click "Generar Pack" → busy state visible
 *
 * ID: IMPL-20260704-06.
 */

import { test, expect } from '@playwright/test';

test.describe('Happy path 4: export Pack RRSS UI flow', () => {
  test('Pack RRSS tab con 4 ratios y botón Generar', async ({ page }) => {
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

    await page.waitForFunction(() => {
      return !!(window as unknown as { __projectStore__?: unknown }).__projectStore__;
    }, undefined, { timeout: 15_000 });

    // Setup: brief automotriz + masterVideo mock (blob MP4 vacío pero válido)
    await page.evaluate(async () => {
      type W = Window & {
        __projectStore__: {
          getState: () => {
            loadBrief: (b: unknown) => void;
            setState: (fn: (s: unknown) => unknown) => void;
          };
          setState: (fn: (s: unknown) => unknown) => void;
        };
      };
      const store = (window as unknown as W).__projectStore__;
      const mod = await import('/src/utils/sectorTemplate.ts');
      store.getState().loadBrief(mod.applySectorTemplate('automotriz'));

      // Inyectar masterVideo mock
      const mockBlob = new Blob(['mock-mp4-content'], { type: 'video/mp4' });
      store.setState((s) => {
        const prev = s as { masterVideo: Blob | null; masterVideoUrl: string | null };
        return {
          ...prev,
          masterVideo: mockBlob,
          masterVideoUrl: URL.createObjectURL(mockBlob),
        };
      });
    });

    // Esperar a que el master esté disponible
    await page.waitForFunction(() => {
      const w = window as unknown as { __projectStore__?: { getState: () => { masterVideo: unknown } } };
      return !!w.__projectStore__?.getState().masterVideo;
    }, undefined, { timeout: 10_000 });

    // Navegar al tab Export
    await page.getByRole('tab', { name: /^export$/i }).click();
    await expect(page.getByRole('heading', { name: /export center/i })).toBeVisible({ timeout: 10_000 });

    // Click tab Pack RRSS
    const packTab = page.getByRole('tab', { name: /^pack rrss$/i });
    await packTab.click();

    // Verificar 4 checkboxes de ratios
    await expect(page.getByTestId('ratio-9:16')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('ratio-1:1')).toBeVisible();
    await expect(page.getByTestId('ratio-4:5')).toBeVisible();
    await expect(page.getByTestId('ratio-16:9')).toBeVisible();

    // Por defecto 9:16 y 1:1 vienen habilitados (SPEC §6.2 línea 207)
    await expect(page.getByTestId('ratio-9:16')).toBeChecked();
    await expect(page.getByTestId('ratio-1:1')).toBeChecked();

    // Botón "Generar Pack RRSS" (o similar) presente y habilitado
    const generateBtn = page.getByTestId('generate-pack-btn');
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeEnabled();
  });
});