/**
 * useFocusTrap — atrapa el foco dentro de un contenedor (modales, dialogs).
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.5.
 *
 * - Al activarse, mueve foco al primer elemento focusable.
 * - Tab desde el último → vuelve al primero.
 * - Shift+Tab desde el primero → salta al último.
 * - Al desactivarse (cleanup), restaura foco al elemento que abrió el modal
 *   (capturado en el momento de activación).
 *
 * Edge cases manejados:
 *  - Sin focusables: no hace nada.
 *  - Elemento con disabled: se filtra (no es focusable).
 *  - Elemento sin tabindex positivo explícito pero con atributo tabindex="-1": filtrado.
 *  - active=false: cleanup sin focus.
 *  - containerRef.current null: skip silencioso.
 *
 * NOTA: No usamos `el.offsetParent !== null` para detectar visibilidad porque
 * en jsdom todos los elementos sin posicionamiento CSS tienen offsetParent=null,
 * lo que rompe tests y edge cases reales. Filtramos solo por disabled y
 * tabindex="-1"; el navegador real gestiona visibilidad via tab-order natural.
 */

import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && !el.hasAttribute('hidden'),
  );
}

export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const focusables = getFocusable(container);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Captura el elemento que tenía foco antes (para restaurar al cerrar)
    const triggerElement = (document.activeElement as HTMLElement | null) ?? null;

    first.focus();

    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const active = document.activeElement as HTMLElement | null;
      // Si el foco se salió del contenedor (p.ej. click fuera), devolverlo
      if (!container.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handler);

    return () => {
      container.removeEventListener('keydown', handler);
      // Restaurar foco al trigger (no al body)
      triggerElement?.focus?.();
    };
  }, [active, containerRef]);
}