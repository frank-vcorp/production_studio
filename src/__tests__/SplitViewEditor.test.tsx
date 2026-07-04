/**
 * Tests para SplitViewEditor.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.1 — 5 tests mínimos.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SplitViewEditor } from '@/components/generation/SplitViewEditor';
import type { Keyframe, CameraSpec } from '@/types/keyframe';
import type { KeyframeTransition, PromptVersion } from '@/types/transition';

const cameraSpec: CameraSpec = {
  movement: 'dolly out',
  framing: 'medium',
  angle: 'eye level',
  speed: 'medium',
};

const kfFrom: Keyframe = {
  id: 'kf1',
  role: 'deseo_in',
  label: 'Solución',
  description: 'Foto real: el resultado final',
  source: 'user_upload',
  timestamp: 0,
  status: 'approved',
};

const kfTo: Keyframe = {
  id: 'kf2',
  role: 'deseo_out',
  label: 'OUT',
  description: 'Auto',
  source: 'generated_imagen3',
  timestamp: 0,
  status: 'generated',
};

const transition: KeyframeTransition = {
  id: 't-test-1',
  fromKeyframe: 'kf1',
  toKeyframe: 'kf2',
  nodeKey: 'deseo',
  duration: 7,
  prompt: 'Prompt original',
  cameraSpec,
  status: 'approved',
  videoUrl: 'blob:test-url',
  promptHistory: [],
};

const promptVersion: PromptVersion = {
  version: 1,
  prompt: 'Prompt current',
  approvedAt: Date.now(),
  approvedBy: 'user',
};

function makeProps(overrides: Partial<Parameters<typeof SplitViewEditor>[0]> = {}) {
  return {
    transitionId: 't-test-1',
    transition,
    keyframeFrom: kfFrom,
    keyframeTo: kfTo,
    promptVersion,
    versions: [promptVersion],
    onApprove: vi.fn().mockResolvedValue(undefined),
    onRegenerateVisual: vi.fn().mockResolvedValue(undefined),
    onRegenerateVO: vi.fn().mockResolvedValue(undefined),
    onUpdateSubtitles: vi.fn().mockResolvedValue(undefined),
    onUpdateCameraSpec: vi.fn().mockResolvedValue(undefined),
    onRestoreVersion: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('<SplitViewEditor />', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Renderiza con split 50/50 inicial (sin localStorage previo)', () => {
    render(<SplitViewEditor {...makeProps()} />);
    const left = screen.getByTestId('split-left') as HTMLDivElement;
    const right = screen.getByTestId('split-right') as HTMLDivElement;
    expect(left.style.width).toBe('50%');
    expect(right.style.width).toBe('50%');
  });

  it('Click tab cambia activeTab', () => {
    render(<SplitViewEditor {...makeProps()} />);
    const tab = screen.getByTestId('tab-vo');
    expect(tab).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(tab);
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  it('Cmd+Enter dispara onApprove con draft', () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(<SplitViewEditor {...makeProps({ onApprove })} />);
    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith('Prompt current');
  });

  it('Esc dispara onClose', () => {
    const onClose = vi.fn();
    render(<SplitViewEditor {...makeProps({ onClose })} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('localStorage persiste split position por transitionId al desmontar', () => {
    const { unmount } = render(<SplitViewEditor {...makeProps()} />);
    // Forzamos escritura: el effect corre en mount con isDragging=false
    // El valor persistido debe existir (50 inicial)
    unmount();
    const stored = localStorage.getItem('split_t-test-1');
    expect(stored).toBe('50');
  });

  it('localStorage previo se respeta al montar', () => {
    localStorage.setItem('split_t-test-1', '65');
    render(<SplitViewEditor {...makeProps()} />);
    const left = screen.getByTestId('split-left') as HTMLDivElement;
    expect(left.style.width).toBe('65%');
  });
});