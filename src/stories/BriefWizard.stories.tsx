/**
 * BriefWizard — Storybook catalog (modo lectura).
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * Renderiza el wizard en estado "paso 0" (Negocio) para inspección visual.
 * Estado interno (setBrief) requiere interacción; aquí sólo se documenta UI.
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { BriefWizard } from '@/components/brief/BriefWizard';

const meta: Meta<typeof BriefWizard> = {
  title: 'Onboarding/BriefWizard',
  component: BriefWizard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Wizard de 3 pasos para capturar el brief publicitario. Conecta con `useProjectStore.loadBrief` al completar.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof BriefWizard>;

export const StepBusiness: Story = {
  render: () => (
    <div style={{ width: 720, maxWidth: '100%' }}>
      <BriefWizard />
    </div>
  ),
};