/**
 * Tests del módulo SECTOR_TEMPLATES.
 * Verifica: 6 sectores presentes, automotriz tiene ≥3 servicios, 'otro' vacío.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.2.
 * ID: IMPL-20260704-05.
 */

import { describe, it, expect } from 'vitest';
import { SECTOR_TEMPLATES, SECTOR_IDS, getSectorTemplate } from '@/data/sectorTemplates';

describe('SECTOR_TEMPLATES', () => {
  it('expone los 6 sectores requeridos por la SPEC', () => {
    expect(SECTOR_IDS).toHaveLength(6);
    for (const id of SECTOR_IDS) {
      expect(SECTOR_TEMPLATES[id]).toBeDefined();
      expect(SECTOR_TEMPLATES[id].id).toBe(id);
      expect(SECTOR_TEMPLATES[id].name).toBeTruthy();
      expect(SECTOR_TEMPLATES[id].emoji).toBeTruthy();
      expect(SECTOR_TEMPLATES[id].description).toBeTruthy();
    }
  });

  it('automotriz incluye los 3 servicios típicos (Cambio aceite, Frenos, Pintura)', () => {
    const auto = SECTOR_TEMPLATES.automotriz;
    expect(auto.defaultServices.length).toBeGreaterThanOrEqual(3);
    const names = auto.defaultServices.map((s) => s.name);
    expect(names.some((n) => /Aceite/i.test(n))).toBe(true);
    expect(names.some((n) => /Frenos/i.test(n))).toBe(true);
    expect(names.some((n) => /Pintura/i.test(n))).toBe(true);
    // Cada servicio tiene copy AIDA completo en defaultStages
    for (const svc of auto.defaultServices) {
      const stages = auto.defaultStages[svc.id];
      expect(stages).toBeDefined();
      expect(stages.attention).toBeTruthy();
      expect(stages.interest).toBeTruthy();
      expect(stages.desire).toBeTruthy();
      expect(stages.action).toBeTruthy();
    }
  });

  it("'otro' tiene defaults vacíos para entrada manual sin errores", () => {
    const otro = SECTOR_TEMPLATES.otro;
    expect(otro.defaultServices).toEqual([]);
    expect(otro.defaultStages).toEqual({});
    expect(otro.defaultBusiness).toEqual({});
    expect(otro.defaultGlobalVision).toEqual({});
  });

  it('getSectorTemplate retorna la plantilla correcta o fallback a otro', () => {
    expect(getSectorTemplate('automotriz').id).toBe('automotriz');
    expect(getSectorTemplate('no-existe').id).toBe('otro');
  });
});