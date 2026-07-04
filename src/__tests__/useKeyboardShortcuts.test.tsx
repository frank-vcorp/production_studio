/**
 * Tests para useKeyboardShortcuts.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.6 — 6 tests mínimos.
 *
 * Estrategia: renderizar un componente host que llame al hook
 * y disparar eventos window keydown con `fireEvent.keyDown(document)`.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useKeyboardShortcuts, type KeyboardShortcutsConfig } from '@/hooks/useKeyboardShortcuts';

interface HostProps {
  config: KeyboardShortcutsConfig;
  enabled?: boolean;
}

function Host({ config, enabled }: HostProps): JSX.Element {
  useKeyboardShortcuts(config, enabled);
  return <div data-testid="host">host</div>;
}

function makeConfig(overrides: Partial<KeyboardShortcutsConfig> = {}): {
  config: KeyboardShortcutsConfig;
  spy: {
    onApprove: ReturnType<typeof vi.fn>;
    onSave: ReturnType<typeof vi.fn>;
    onUndo: ReturnType<typeof vi.fn>;
    onRedo: ReturnType<typeof vi.fn>;
    onClose: ReturnType<typeof vi.fn>;
    onCycleTab: ReturnType<typeof vi.fn>;
  };
} {
  const spy = {
    onApprove: vi.fn(),
    onSave: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onClose: vi.fn(),
    onCycleTab: vi.fn(),
  };
  return { config: { ...spy, ...overrides }, spy };
}

describe('useKeyboardShortcuts', () => {
  it('Cmd+Enter dispara onApprove', () => {
    const { config, spy } = makeConfig();
    render(<Host config={config} />);
    // jsdom default: navigator.platform = ... varies. macOS check uses .includes('Mac').
    // Forzamos navigator.platform via Object.defineProperty (jsdom es Linux-like).
    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
    expect(spy.onApprove).toHaveBeenCalledTimes(1);
  });

  it('Esc dispara onClose', () => {
    const { config, spy } = makeConfig();
    render(<Host config={config} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(spy.onClose).toHaveBeenCalledTimes(1);
  });

  it('Cmd+S dispara onSave', () => {
    const { config, spy } = makeConfig();
    render(<Host config={config} />);
    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }));
    expect(spy.onSave).toHaveBeenCalledTimes(1);
  });

  it('Tab cicla tab con direction=1', () => {
    const { config, spy } = makeConfig();
    render(<Host config={config} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(spy.onCycleTab).toHaveBeenCalledWith(1);
  });

  it('Shift+Tab cicla con direction=-1', () => {
    const { config, spy } = makeConfig();
    render(<Host config={config} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(spy.onCycleTab).toHaveBeenCalledWith(-1);
  });

  it('Cmd+Z dispara onUndo (sin shift)', () => {
    const { config, spy } = makeConfig();
    render(<Host config={config} />);
    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
    expect(spy.onUndo).toHaveBeenCalledTimes(1);
    expect(spy.onRedo).not.toHaveBeenCalled();
  });

  it('Cmd+Shift+Z dispara onRedo', () => {
    const { config, spy } = makeConfig();
    render(<Host config={config} />);
    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', metaKey: true, shiftKey: true }));
    expect(spy.onRedo).toHaveBeenCalledTimes(1);
  });

  it('Cuando enabled=false → ningún listener se attached', () => {
    const { config, spy } = makeConfig();
    render(<Host config={config} enabled={false} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(spy.onClose).not.toHaveBeenCalled();
    expect(spy.onApprove).not.toHaveBeenCalled();
  });

  it('Ctrl+Enter en plataforma no-Mac dispara onApprove', () => {
    const { config, spy } = makeConfig();
    render(<Host config={config} />);
    Object.defineProperty(window.navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    expect(spy.onApprove).toHaveBeenCalledTimes(1);
  });
});