/**
 * LandingPage — Storybook catalog.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * Renderiza la landing con handlers noop.
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { LandingPage } from '@/components/landing/LandingPage';

const meta: Meta<typeof LandingPage> = {
  title: 'Onboarding/LandingPage',
  component: LandingPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj<typeof LandingPage>;

const noop = () => undefined;
const noopSector = (_s: string) => undefined;

export const FreshUser: Story = {
  args: {
    onCreateSpot: noop,
    onStartTour: noop,
    onSelectSector: noopSector,
    hasSeenTour: false,
  },
};

export const ReturningUser: Story = {
  args: {
    onCreateSpot: noop,
    onStartTour: noop,
    onSelectSector: noopSector,
    hasSeenTour: true,
  },
};