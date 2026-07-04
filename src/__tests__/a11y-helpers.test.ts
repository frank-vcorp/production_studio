/**
 * Tests de a11y helpers puros.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.3.
 * ID: IMPL-20260704-05.
 */

import { describe, it, expect } from 'vitest';
import {
  ariaLabelForService,
  ariaLabelForTransition,
  ariaLabelForKeyframe,
  ariaLivePolitelyProps,
  ariaLiveAssertiveProps,
} from '@/utils/a11y';
import type { ServiceToAdvertise } from '@/types/brief';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';

describe('a11y helpers', () => {
  it('ariaLabelForService concatena nombre + descripción truncada a 80 chars', () => {
    const svc: ServiceToAdvertise = {
      id: 'svc_x',
      name: 'Corte y Peinado',
      description: 'A'.repeat(120),
      keyBenefit: 'beneficio',
      stages: { attention: '', interest: '', desire: '', action: '' },
    };
    const label = ariaLabelForService(svc);
    expect(label).toBe(`Corte y Peinado: ${'A'.repeat(80)}`);
    expect(label.length).toBe('Corte y Peinado: '.length + 80);
  });

  it('ariaLabelForTransition retorna "Nodo X, estado Y"', () => {
    const t: Pick<KeyframeTransition, 'status'> = { status: 'generating' };
    const label = ariaLabelForTransition(t as KeyframeTransition, 'atencion');
    expect(label).toBe('Nodo atencion, estado generating');
  });

  it('ariaLabelForKeyframe maneja keyframe undefined', () => {
    expect(ariaLabelForKeyframe(undefined, 'bumper_start')).toBe(
      'Keyframe bumper_start: empty',
    );
    const kf: Partial<Keyframe> = { label: 'Atención', status: 'approved' };
    expect(ariaLabelForKeyframe(kf as Keyframe, 'atencion_in')).toBe(
      'Keyframe Atención: approved',
    );
  });

  it('ariaLivePolitelyProps retorna aria-live polite + aria-atomic true', () => {
    expect(ariaLivePolitelyProps()).toEqual({
      'aria-live': 'polite',
      'aria-atomic': true,
    });
  });

  it('ariaLiveAssertiveProps retorna aria-live assertive', () => {
    expect(ariaLiveAssertiveProps()['aria-live']).toBe('assertive');
    expect(ariaLiveAssertiveProps()['aria-atomic']).toBe(true);
  });
});