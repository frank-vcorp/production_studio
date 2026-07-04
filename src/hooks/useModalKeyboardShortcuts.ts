/**
 * useModalKeyboardShortcuts — Hook centralizado para atajos de teclado en modales.
 *
 * Resuelve el patrón repetido en PromptApprovalGate, SplitViewEditor y futuros
 * modales: Esc para cerrar + opcional Tab cycling (ya en useFocusTrap).
 *
 * Spec: SPEC-S5-WIZARD-A11Y + sugerencia S6 #1 de GEMINI (S5 audit H1).
 */
import { useEffect } from 'react';

export interface ModalKeyboardShortcutsConfig {
  /** Si true, el listener está activo. Típicamente `modalOpen` state. */
  enabled: boolean;
  /** Callback al presionar Esc. Típicamente `onClose`. */
  onClose: () => void;
  /** Stop default browser behavior (default true para evitar scroll, history back, etc). */
  preventDefault?: boolean;
}

export function useModalKeyboardShortcuts({
  enabled,
  onClose,
  preventDefault = true,
}: ModalKeyboardShortcutsConfig): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (preventDefault) e.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [enabled, onClose, preventDefault]);
}