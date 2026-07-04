/**
 * Tests para InlineNodeEditor.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.3 — 4 tests mínimos.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineNodeEditor } from '@/components/generation/InlineNodeEditor';
import type { Keyframe, CameraSpec } from '@/types/keyframe';
import type { KeyframeTransition } from '@/types/transition';

const kfFrom: Keyframe = {
  id: 'kf1',
  role: 'atencion_in',
  label: 'Problema',
  description: 'Foto real: el problema que resuelves',
  source: 'user_upload',
  timestamp: 0,
  status: 'approved',
  humanIntent: 'motor sucio desenfocado',
};

const kfTo: Keyframe = {
  id: 'kf2',
  role: 'atencion_out',
  label: 'OUT',
  description: 'Generada por Imagen 3',
  source: 'generated_imagen3',
  timestamp: 0,
  status: 'generated',
};

const cameraSpec: CameraSpec = {
  movement: 'dolly out',
  framing: 'medium',
  angle: 'eye level',
  speed: 'medium',
};

const transition: KeyframeTransition = {
  id: 't1',
  fromKeyframe: 'kf1',
  toKeyframe: 'kf2',
  nodeKey: 'atencion',
  duration: 4,
  prompt: '',
  cameraSpec,
  status: 'pending',
  promptHistory: [],
};

function makeProps(overrides: Partial<Parameters<typeof InlineNodeEditor>[0]> = {}) {
  return {
    transition,
    keyframeFrom: kfFrom,
    keyframeTo: kfTo,
    onRegenerateVisual: vi.fn().mockResolvedValue(undefined),
    onRegenerateVO: vi.fn().mockResolvedValue(undefined),
    onUpdateSubtitles: vi.fn().mockResolvedValue(undefined),
    onUpdateCameraSpec: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('<InlineNodeEditor />', () => {
  it('Render inicial muestra VisualTab', () => {
    render(<InlineNodeEditor {...makeProps()} />);
    expect(screen.getByTestId('tab-visual')).toBeInTheDocument();
    expect(screen.getByTestId('inline-node-editor')).toBeInTheDocument();
  });

  it('Click tab "vo" muestra VOTab', () => {
    render(<InlineNodeEditor {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-vo'));
    expect(screen.getByTestId('tab-vo')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-vo')).toBeInTheDocument();
  });

  it('Click tab "camera" muestra CameraTab', () => {
    render(<InlineNodeEditor {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-camera'));
    expect(screen.getByTestId('tab-camera')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('camera-movement')).toBeInTheDocument();
  });

  it('Click "Regenerar Visual" llama callback con intent', async () => {
    const onRegenerateVisual = vi.fn().mockResolvedValue(undefined);
    render(<InlineNodeEditor {...makeProps({ onRegenerateVisual })} />);
    const textarea = screen.getByTestId('visual-intent') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'abrir a plano detalle' } });
    fireEvent.click(screen.getByTestId('regenerate-visual'));
    await waitFor(() => {
      expect(onRegenerateVisual).toHaveBeenCalledWith('abrir a plano detalle');
    });
  });
});