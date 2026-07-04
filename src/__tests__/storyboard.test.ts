import { describe, it, expect } from 'vitest';
import { STORYBOARD_SLOTS } from '@/types/keyframe';
import { TRANSITION_DURATIONS } from '@/types/transition';

describe('slot topology', () => {
  it('STORYBOARD_SLOTS contiene los 6 roles base', () => {
    expect(STORYBOARD_SLOTS.length).toBe(6);
    const roles = STORYBOARD_SLOTS.map((s) => s.role);
    expect(roles).toContain('bumper_start');
    expect(roles).toContain('atencion_in');
    expect(roles).toContain('interes_in');
    expect(roles).toContain('deseo_in');
    expect(roles).toContain('accion_in');
    expect(roles).toContain('cta_final');
  });

  it('TRANSITION_DURATIONS suma ~27s (target AIDA)', () => {
    const sum = Object.values(TRANSITION_DURATIONS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(27);
  });
});
