/**
 * applySectorTemplate / buildEmptyBrief — cobertura utils/sectorTemplate.
 * Spec: SPEC-S6-TESTS-CICD §6.1.
 *
 * ID: IMPL-20260704-06.
 */
import { describe, it, expect } from 'vitest';
import { applySectorTemplate, buildEmptyBrief } from '@/utils/sectorTemplate';

describe('buildEmptyBrief', () => {
  it('devuelve un brief con id, fechas y defaults', () => {
    const b = buildEmptyBrief();
    expect(b.id).toMatch(/^brief_/);
    expect(b.business.sector).toBe('otro');
    expect(b.services).toEqual([]);
    expect(b.globalVision.toneKeywords.length).toBeGreaterThan(0);
    expect(b.createdAt).toBeGreaterThan(0);
    expect(b.createdAt).toBe(b.updatedAt);
  });
});

describe('applySectorTemplate', () => {
  it('automotriz aplica defaults del sector y servicios pre-llenados', () => {
    const brief = applySectorTemplate('automotriz');
    expect(brief.business.sector).toBe('automotriz');
    // automotriz.defaultBusiness solo setea audience + differentiators (NO name —
    // el usuario lo llena en el wizard).
    expect(brief.business.audience).not.toBe('');
    expect(brief.business.differentiators.length).toBeGreaterThan(0);
    expect(brief.services.length).toBeGreaterThanOrEqual(2);
    for (const svc of brief.services) {
      expect(svc.name).not.toBe('');
      expect(svc.description).not.toBe('');
    }
  });

  it('estética tiene al menos 1 servicio', () => {
    const brief = applySectorTemplate('estetica');
    expect(brief.services.length).toBeGreaterThanOrEqual(1);
  });

  it('updatedAt se refresca en cada llamada', async () => {
    const a = applySectorTemplate('comida');
    await new Promise((r) => setTimeout(r, 5));
    const b = applySectorTemplate('comida');
    expect(b.updatedAt).toBeGreaterThan(a.updatedAt);
  });

  it('mutación del resultado no afecta otros calls (deep clone)', () => {
    const a = applySectorTemplate('automotriz');
    const clone1Services = a.services.map((s) => s.stages);
    const b = applySectorTemplate('automotriz');
    expect(b.services[0].stages).toEqual(clone1Services[0]);
    // Mutar b no debe afectar referencias internas compartidas:
    b.services[0].stages.attention = 'mutada';
    expect(a.services[0].stages.attention).not.toBe('mutada');
  });

  it('id único entre llamadas', () => {
    const a = applySectorTemplate('salud');
    const b = applySectorTemplate('salud');
    expect(a.id).not.toBe(b.id);
  });

  it('sector desconocido cae a defaults sin crashear', () => {
    const brief = applySectorTemplate('otro');
    expect(brief.business.sector).toBe('otro');
  });
});
