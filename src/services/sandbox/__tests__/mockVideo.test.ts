/**
 * Tests para mockVideo (sandbox determinista de Veo 3.1).
 * Spec: ARCH-20260705-04.
 */
import { describe, it, expect } from 'vitest';
import {
  mockStartVideoGeneration,
  mockPollVideoOperation,
  mockExtractVideoFromOperation,
} from '@/services/sandbox/mockVideo';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';

// Polyfill URL.createObjectURL/revokeObjectURL (jsdom no los trae).
if (typeof URL.createObjectURL === 'undefined') {
  let nextId = 0;
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) =>
    `blob:test://${++nextId}#${(b as Blob).size ?? 0}`;
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => undefined;
}

const transition: KeyframeTransition = {
  id: 'trans_sandbox',
  fromKeyframe: 'kf_a',
  toKeyframe: 'kf_b',
  nodeKey: 'atencion',
  duration: 4,
  prompt: 'test prompt',
  promptFinal: 'test prompt final',
  cameraSpec: { movement: 'dolly', framing: 'medium', angle: 'eye', speed: 'medium' },
  status: 'approved',
  promptHistory: [],
};

const kfFrom: Keyframe = {
  id: 'kf_a',
  role: 'atencion_in',
  label: 'A',
  description: '',
  source: 'user_upload',
  base64: 'iVBORw0KGgo=',
  mimeType: 'image/png',
  timestamp: 0,
  status: 'approved',
};

const kfTo: Keyframe = {
  id: 'kf_b',
  role: 'atencion_out',
  label: 'B',
  description: '',
  source: 'generated_imagen3',
  base64: 'iVBORw0KGgo=',
  mimeType: 'image/png',
  timestamp: 1,
  status: 'approved',
};

describe('sandbox/mockVideo', () => {
  it('mockStartVideoGeneration devuelve VideoOperation con name sandbox-ops-*', async () => {
    const op = await mockStartVideoGeneration({ transition, fromKeyframe: kfFrom, toKeyframe: kfTo });
    expect(op.name).toMatch(/^sandbox-ops-/);
    expect(op.done).toBe(false);
  });

  it('mockPollVideoOperation devuelve done=true con response', async () => {
    const op = await mockPollVideoOperation('sandbox-ops-test');
    expect(op.name).toBe('sandbox-ops-test');
    expect(op.done).toBe(true);
    expect(op.response).toBeDefined();
  });

  it('mockExtractVideoFromOperation devuelve {blob, url, operationId}', async () => {
    const op = await mockStartVideoGeneration({ transition, fromKeyframe: kfFrom, toKeyframe: kfTo });
    const { blob, url, operationId } = await mockExtractVideoFromOperation(op, kfFrom, transition);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(typeof url).toBe('string');
    expect(url.startsWith('blob:')).toBe(true);
    expect(operationId).toBe(op.name);
    URL.revokeObjectURL(url);
  });
});