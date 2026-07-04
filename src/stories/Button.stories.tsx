/**
 * Button — variants y sizes para catalogar en Storybook.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/common/Button';

const meta: Meta<typeof Button> = {
  title: 'Common/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'success', 'danger', 'ghost'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    icon: { control: 'text' },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Acción primaria' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Acción secundaria' },
};

export const Success: Story = {
  args: { variant: 'success', children: 'Confirmar', icon: 'fa-check' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Eliminar', icon: 'fa-trash' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Cancelar' },
};

export const WithIcon: Story = {
  args: { variant: 'primary', children: 'Generar lote', icon: 'fa-bolt' },
};

export const Loading: Story = {
  args: { variant: 'primary', children: 'Generando…', loading: true },
};

export const Sizes: Story = {
  args: { children: 'Botón' },
  render: (args) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Button {...args} size="sm">Pequeño</Button>
      <Button {...args} size="md">Mediano</Button>
      <Button {...args} size="lg">Grande</Button>
    </div>
  ),
};