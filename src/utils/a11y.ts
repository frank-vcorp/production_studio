/**
 * a11y helpers — funciones puras para construir aria-labels y props live.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.3.
 *
 * Funciones exportadas:
 *  - ariaLabelForService(service): "Servicio: descripción truncada"
 *  - ariaLabelForTransition(transition, nodeKey): "Nodo X, estado Y"
 *  - ariaLivePolitelyProps(): { 'aria-live': 'polite', 'aria-atomic': true }
 *  - ariaLabelForKeyframe(kf, role): "Keyframe ROL: status"
 *
 * Todas son puras (sin hooks) → fáciles de testear.
 * ID: IMPL-20260704-05.
 */

import type { ServiceToAdvertise } from '@/types/brief';
import type { KeyframeTransition, AidaNodeKey } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';

const MAX_DESC_CHARS = 80;

export function ariaLabelForService(service: ServiceToAdvertise): string {
  const desc = service.description.slice(0, MAX_DESC_CHARS).trim();
  return desc ? `${service.name}: ${desc}` : service.name;
}

export function ariaLabelForTransition(
  transition: KeyframeTransition,
  nodeKey: AidaNodeKey | string,
): string {
  return `Nodo ${nodeKey}, estado ${transition.status}`;
}

export function ariaLabelForKeyframe(kf: Keyframe | undefined, role: string): string {
  const status = kf?.status ?? 'empty';
  const label = kf?.label ?? role;
  return `Keyframe ${label}: ${status}`;
}

export interface AriaLivePolitelyProps {
  'aria-live': 'polite';
  'aria-atomic': boolean;
}

export function ariaLivePolitelyProps(): AriaLivePolitelyProps {
  return { 'aria-live': 'polite', 'aria-atomic': true };
}

export interface AriaLiveAssertiveProps {
  'aria-live': 'assertive';
  'aria-atomic': boolean;
}

/** Usar SOLO para alertas críticas (errores fatales). NO usar para progreso. */
export function ariaLiveAssertiveProps(): AriaLiveAssertiveProps {
  return { 'aria-live': 'assertive', 'aria-atomic': true };
}