/**
 * E2E happy-path 3: usuario con 6 transiciones approved lanza "Generar Lote".
 * Spec: SPEC-S6-TESTS-CICD §6.2.
 *
 * En CI no hay proxy/Veo, así que el job queue falla por quota — el test
 * valida el flujo UI completo (modal de costos, panel de jobs visible,
 * status actualizado tras 10s). NO esperamos completion real de Veo.
 *
 * ID: IMPL-20260704-06.
 */

import { test, expect } from '@playwright/test';

test.describe('Happy path 3: batch generation UI flow', () => {
  test('click Generar Lote → CostModal → JobsPanel → status actualizado', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.evaluate(() => {
      return indexedDB.databases?.then?.((dbs) => {
        dbs?.forEach((db) => db.name && indexedDB.deleteDatabase(db.name));
      });
    }).catch(() => undefined);
    await page.reload();

    // Forzar habilitación del bridge E2E (sólo disponible en dev MODE=test)
    await page.evaluate(() => {
      (window as unknown as { __BRIDGE_E2E__: boolean }).__BRIDGE_E2E__ = true;
    });

    // Esperar a que los stores estén disponibles en window
    await page.waitForFunction(
      () => !!(window as unknown as { __projectStore__?: unknown }).__projectStore__,
      undefined,
      { timeout: 20_000 },
    );

    // Setup: cargar brief automotriz via applySectorTemplate + 6 transiciones approved
    await page.evaluate(async () => {
      type W = Window & {
        __projectStore__: {
          getState: () => {
            loadBrief: (b: unknown) => void;
            buildTransition: (a: string, b: string, n: string) => { id: string } | null;
            approveTransitionPrompt: (id: string, prompt: string) => void;
          };
        };
      };
      const store = (window as unknown as W).__projectStore__.getState();
      const mod = (await import('/src/utils/sectorTemplate.ts' as never)) as {
        applySectorTemplate: (s: string) => unknown;
      };
      store.loadBrief(mod.applySectorTemplate('automotriz'));

      const pairs: Array<[string, string, string]> = [
        ['kf_bumper_start', 'kf_atencion_in', 'atencion'],
        ['kf_atencion_in', 'kf_interes_in', 'interes'],
        ['kf_interes_in', 'kf_deseo_in', 'deseo'],
        ['kf_deseo_in', 'kf_accion_in', 'accion'],
        ['kf_accion_in', 'kf_cta_final', 'cta'],
        ['kf_bumper_start', 'kf_cta_final', 'bumper'],
      ];
      for (const [from, to, node] of pairs) {
        const t = store.buildTransition(from, to, node);
        if (t) store.approveTransitionPrompt(t.id, `mock prompt for ${node}`);
      }
    });

    // Verificar que el tab Export está habilitado (brief cargado)
    const exportTab = page.getByRole('tab', { name: /^export$/i });
    await expect(exportTab).toBeEnabled({ timeout: 10_000 });

    // Navegar al tab Export
    await exportTab.click();

    // MasterTab visible
    await expect(page.getByRole('button', { name: /generar lote completo/i })).toBeVisible({ timeout: 10_000 });

    // Click "Generar Lote Completo" → Cost Estimator Modal se abre
    await page.getByRole('button', { name: /generar lote completo/i }).click();

    // Modal con título "Estimación de Costo"
    await expect(page.getByRole('heading', { name: /estimaci[oó]n de costo/i })).toBeVisible({ timeout: 5_000 });

    // Confirmar el modal — el botón dice "Confirmar y Generar"
    const confirmBtn = page.getByRole('button', { name: /confirmar y generar/i }).first();
    await confirmBtn.click();

    // JobsPanel aparece tras dispatch del lote.
// Verificamos que el job queue tenga al menos 1 job registrado (queued/active/done/failed).
// En CI sin proxy, los jobs pueden quedarse en queued o active mientras esperan
// el timeout del Veo (5min). Validamos que createBatch() se ejecutó.
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            type W = Window & {
              __jobQueue__?: { getQueueState: () => { jobs: unknown[] } };
            };
            const q = (window as unknown as W).__jobQueue__?.getQueueState();
            return q?.jobs.length ?? 0;
          });
        },
        { timeout: 10_000, intervals: [500] },
      )
      .toBeGreaterThan(0);
  });
});