/**
 * PromptApprovalGate — Storybook catalog.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * Renderiza el gate modal (cuando activeTransitionId !== null).
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { PromptApprovalGate } from '@/components/prompt/PromptApprovalGate';
import { useProjectStore } from '@/stores/projectStore';

function withActiveTransition(Story: React.ComponentType): JSX.Element {
  const Wrapped = () => {
    useEffect(() => {
      const t = useProjectStore.getState().buildTransition('kf_a', 'kf_b', 'atencion');
      if (t) {
        useProjectStore.setState({
          activeTransitionId: t.id,
          promptGateOpen: true,
        });
      }
    }, []);
    return <Story />;
  };
  return <Wrapped />;
}

const meta: Meta<typeof PromptApprovalGate> = {
  title: 'Generation/PromptApprovalGate',
  component: PromptApprovalGate,
  tags: ['autodocs'],
  decorators: [(Story) => withActiveTransition(Story as React.ComponentType)],
};
export default meta;

type Story = StoryObj<typeof PromptApprovalGate>;

export const Open: Story = {};