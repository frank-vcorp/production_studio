/**
 * SplitViewEditor — Storybook catalog con mock minimal.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * Renderiza el split view con un transition mock. El componente tiene muchos
 * handlers; aquí proporcionamos stubs.
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { SplitViewEditor } from '@/components/generation/SplitViewEditor';
import type { Keyframe, CameraSpec } from '@/types/keyframe';
import type { KeyframeTransition, PromptVersion } from '@/types/transition';

const mockKf: Keyframe = {
  id: 'kf_x',
  role: 'atencion_in',
  label: 'Atención',
  description: '',
  source: 'user_upload',
  status: 'uploaded',
  timestamp: 0,
};

const mockCamera: CameraSpec = {
  movement: 'macro_probe',
  framing: 'macro',
  angle: 'eye_level',
  speed: 'slow',
};

const mockTransition: KeyframeTransition = {
  id: 'trans_x',
  nodeKey: 'atencion',
  fromKeyframe: 'kf_a',
  toKeyframe: 'kf_b',
  duration: 4,
  prompt: 'Prompt de ejemplo para el nodo de Atención. Macro close-up.',
  cameraSpec: mockCamera,
  status: 'approved',
  promptHistory: [],
};

const mockVersions: PromptVersion[] = [
  {
    version: 3,
    prompt: 'v3 prompt — versión más reciente',
    approvedAt: Date.now(),
    approvedBy: 'user',
  },
  {
    version: 2,
    prompt: 'v2 prompt — previo',
    approvedAt: Date.now() - 60_000,
    approvedBy: 'user',
    changeReason: 'regenerate_visual',
  },
];

const meta: Meta<typeof SplitViewEditor> = {
  title: 'Generation/SplitViewEditor',
  component: SplitViewEditor,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof SplitViewEditor>;

const asyncNoop = async (): Promise<void> => undefined;

export const Default: Story = {
  args: {
    transitionId: 'trans_x',
    transition: mockTransition,
    keyframeFrom: mockKf,
    keyframeTo: mockKf,
    promptVersion: mockVersions[0],
    versions: mockVersions,
    onApprove: asyncNoop,
    onRegenerateVisual: asyncNoop,
    onRegenerateVO: asyncNoop,
    onUpdateSubtitles: asyncNoop,
    onUpdateCameraSpec: asyncNoop,
    onRestoreVersion: asyncNoop,
    onClose: () => undefined,
  },
};