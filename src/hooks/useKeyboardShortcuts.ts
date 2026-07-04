/**
 * useKeyboardShortcuts — atajos globales para SplitViewEditor y PromptEditor.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.6.
 *
 * Atajos soportados:
 *   - Cmd/Ctrl + Enter    → onApprove
 *   - Cmd/Ctrl + S        → onSave
 *   - Cmd/Ctrl + Z        → onUndo
 *   - Cmd/Ctrl + Shift + Z → onRedo
 *   - Esc                 → onClose
 *   - Tab / Shift+Tab     → onCycleTab (±1)
 *
 * Detección Mac/Win via `navigator.platform`. El flag `enabled` permite
 * desactivar el listener cuando el modal está cerrado.
 */

import { useEffect } from 'react';

export interface KeyboardShortcutsConfig {
  onApprove?: () => void;
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClose?: () => void;
  onCycleTab?: (direction: 1 | -1) => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent): void => {
      const isMac =
        typeof navigator !== 'undefined' &&
        typeof navigator.platform === 'string' &&
        navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + Enter → Aprobar
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        config.onApprove?.();
        return;
      }

      // Cmd/Ctrl + S → Guardar
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        config.onSave?.();
        return;
      }

      // Cmd/Ctrl + Z (sin shift) → Undo
      if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        config.onUndo?.();
        return;
      }

      // Cmd/Ctrl + Shift + Z → Redo
      if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        config.onRedo?.();
        return;
      }

      // Esc → Cerrar
      if (e.key === 'Escape') {
        e.preventDefault();
        config.onClose?.();
        return;
      }

      // Tab → Ciclar (sin modifier)
      if (e.key === 'Tab' && !mod && !e.altKey) {
        e.preventDefault();
        config.onCycleTab?.(e.shiftKey ? -1 : 1);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
    // Re-suscribir si cambia config o enabled
  }, [config, enabled]);
}