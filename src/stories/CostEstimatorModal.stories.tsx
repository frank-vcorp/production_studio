/**
 * CostEstimatorModal — Storybook catalog.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * Muestra el modal abierto con input mock (3 transiciones approved).
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { CostEstimatorModal } from '@/components/generation/CostEstimatorModal';
import type { CostEstimatorInput } from '@/services/costEstimator';
import type { KeyframeTransition } from '@/types/transition';

const sampleInput: CostEstimatorInput = {
  transitions: Array.from({ length: 3 }, (_, i) => ({
    id: `trans_${i}`,
    nodeKey: ['atencion', 'interes', 'deseo'][i] as 'atencion' | 'interes' | 'deseo',
    fromKeyframe: `kf_${i}`,
    toKeyframe: `kf_${i + 1}`,
    duration: 5,
    prompt: 'mock prompt',
    cameraSpec: { movement: 'static', speed: 'normal', focus: 'wide', notes: '' },
    status: 'approved',
    promptHistory: [],
  })) as unknown as KeyframeTransition[],
  keyframesNeedGeneration: [],
  voiceoverText: 'Voiceover de prueba de 5 segundos.',
  voiceoverDurationSec: 5,
  brief: null,
};

const meta: Meta<typeof CostEstimatorModal> = {
  title: 'Generation/CostEstimatorModal',
  component: CostEstimatorModal,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CostEstimatorModal>;

export const Open: Story = {
  args: {
    open: true,
    onClose: () => alert('close'),
    onConfirm: () => alert('confirm'),
    input: sampleInput,
  },
};

export const WithPendingJobs: Story = {
  args: {
    open: true,
    onClose: () => alert('close'),
    onConfirm: () => alert('confirm'),
    input: sampleInput,
    pendingJobs: [
      {
        id: 'j1',
        kind: 'video_generation',
        status: 'active',
        attempts: 0,
        maxAttempts: 5,
        payload: {},
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  },
};