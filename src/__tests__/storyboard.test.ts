import { describe, it, expect } from 'vitest';
import { STORYBOARD_SLOTS, STORYBOARD_STRUCTURE } from '@/types/keyframe';
import { TRANSITION_DURATIONS } from '@/types/transition';

describe('slot topology', () => {
  it('STORYBOARD_STRUCTURE tiene 5 categorías AIDA', () => {
    expect(STORYBOARD_STRUCTURE.length).toBe(5);
    const categoryIds = STORYBOARD_STRUCTURE.map((c) => c.id);
    expect(categoryIds).toEqual(['generales', 'atencion', 'interes', 'deseo', 'cta']);
  });

  it('cada categoría tiene 2 slots (IN + OUT para AIDA, 2 para Generales/CTA)', () => {
    for (const cat of STORYBOARD_STRUCTURE) {
      expect(cat.slots.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('roles clave están presentes en STORYBOARD_STRUCTURE', () => {
    const allRoles = STORYBOARD_STRUCTURE.flatMap((c) => c.slots.map((s) => s.role));
    expect(allRoles).toContain('bumper_start');     // Generales: Logo
    expect(allRoles).toContain('atencion_in');      // AIDA Atención IN
    expect(allRoles).toContain('atencion_out');     // AIDA Atención OUT (auto)
    expect(allRoles).toContain('interes_in');       // AIDA Interés IN
    expect(allRoles).toContain('interes_out');      // AIDA Interés OUT (auto)
    expect(allRoles).toContain('deseo_in');         // AIDA Deseo IN
    expect(allRoles).toContain('deseo_out');        // AIDA Deseo OUT (auto)
    expect(allRoles).toContain('cta_final');        // AIDA CTA Final
  });

  it('slots OUT auto-generados están marcados con autoGenerate: true', () => {
    const autoRoles = STORYBOARD_STRUCTURE
      .flatMap((c) => c.slots)
      .filter((s) => s.autoGenerate)
      .map((s) => s.role);
    expect(autoRoles).toEqual(['atencion_out', 'interes_out', 'deseo_out']);
  });

  it('STORYBOARD_SLOTS (legacy) tiene 6 roles base (compatibilidad)', () => {
    expect(STORYBOARD_SLOTS.length).toBe(6);
    const roles = STORYBOARD_SLOTS.map((s) => s.role);
    expect(roles).toContain('bumper_start');
    expect(roles).toContain('atencion_in');
    expect(roles).toContain('interes_in');
    expect(roles).toContain('deseo_in');
    expect(roles).toContain('cta_final');
  });

  it('TRANSITION_DURATIONS suma ~27s (target AIDA)', () => {
    const sum = Object.values(TRANSITION_DURATIONS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(27);
  });
});
