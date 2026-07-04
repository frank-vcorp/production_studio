/**
 * KeyframeStoryboard — Storybook catalog.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * Renderiza 6 slots del AIDA chain. Requiere `brief` en projectStore; el
 * decorator inyecta un brief mock para que el storyboard sea visible.
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { KeyframeStoryboard } from '@/components/storyboard/KeyframeStoryboard';
import { useProjectStore } from '@/stores/projectStore';
import { useEffect } from 'react';
import type { MasterBrief } from '@/types/brief';

const sampleBrief: MasterBrief = {
  id: 'brief_story',
  business: {
    name: 'CP Test',
    sector: 'automotriz',
    description: 'Taller',
    audience: 'Dueños',
    differentiators: [],
    logoBlob: null,
  },
  services: [
    {
      id: 'svc_a',
      name: 'Cambio de aceite',
      description: 'Sintético',
      keyBenefit: '15k km',
      stages: { attention: 'a', interest: 'i', desire: 'd', action: 'cta' },
    },
  ],
  globalVision: {
    style: 'Cinematográfico',
    musicMood: 'upbeat',
    pacing: 'balanceado',
    toneKeywords: ['confianza'],
    avoidKeywords: [],
  },
  createdAt: 0,
  updatedAt: 0,
};

function withBrief(Story: React.ComponentType): JSX.Element {
  const Wrapped = () => {
    useEffect(() => {
      useProjectStore.getState().loadBrief(sampleBrief);
    }, []);
    return <Story />;
  };
  return <Wrapped />;
}

const meta: Meta<typeof KeyframeStoryboard> = {
  title: 'Storyboard/KeyframeStoryboard',
  component: KeyframeStoryboard,
  tags: ['autodocs'],
  decorators: [(Story) => withBrief(Story as React.ComponentType)],
};
export default meta;

type Story = StoryObj<typeof KeyframeStoryboard>;

export const Default: Story = {
  args: { briefReady: true },
};