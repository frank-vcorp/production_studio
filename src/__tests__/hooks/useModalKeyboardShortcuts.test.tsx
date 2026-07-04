/**
 * useModalKeyboardShortcuts — Esc handler.
 * Spec: SPEC-S6-TESTS-CICD §6.1 (cobertura del fix S5 H1 GEMINI).
 *
 * ID: IMPL-20260704-06.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModalKeyboardShortcuts } from '@/hooks/useModalKeyboardShortcuts';

function pressKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('useModalKeyboardShortcuts', () => {
  it('llama onClose al presionar Esc cuando enabled=true', () => {
    const onClose = vi.fn();
    renderHook(() => useModalKeyboardShortcuts({ enabled: true, onClose }));
    pressKey('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('no llama onClose con otras teclas', () => {
    const onClose = vi.fn();
    renderHook(() => useModalKeyboardShortcuts({ enabled: true, onClose }));
    pressKey('Enter');
    pressKey('a');
    pressKey('Tab');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('no llama onClose cuando enabled=false', () => {
    const onClose = vi.fn();
    renderHook(() => useModalKeyboardShortcuts({ enabled: false, onClose }));
    pressKey('Escape');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('preventDefault=true cancela default (Esc)', () => {
    const onClose = vi.fn();
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(ev, 'preventDefault');
    renderHook(() => useModalKeyboardShortcuts({ enabled: true, onClose, preventDefault: true }));
    window.dispatchEvent(ev);
    expect(onClose).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('preventDefault=false no llama preventDefault', () => {
    const onClose = vi.fn();
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(ev, 'preventDefault');
    renderHook(() => useModalKeyboardShortcuts({ enabled: true, onClose, preventDefault: false }));
    window.dispatchEvent(ev);
    expect(onClose).toHaveBeenCalled();
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
