/**
 * JobsPanel — Storybook catalog con estado mock.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * Inyecta 5 jobs en distintos estados vía jobQueue._seed().
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { JobsPanel } from '@/components/generation/JobsPanel';
import { jobQueue } from '@/services/jobQueue';
import type { BackgroundJob } from '@/types/jobs';

function makeJobs(): BackgroundJob[] {
  const now = Date.now();
  return [
    {
      id: 'j1', kind: 'video_generation', status: 'done', attempts: 1, maxAttempts: 5,
      payload: {}, createdAt: now, updatedAt: now, completedAt: now, latencyMs: 124_000,
    },
    {
      id: 'j2', kind: 'video_generation', status: 'active', attempts: 2, maxAttempts: 5,
      payload: {}, createdAt: now, updatedAt: now,
    },
    {
      id: 'j3', kind: 'video_generation', status: 'done', attempts: 1, maxAttempts: 5,
      payload: {}, createdAt: now, updatedAt: now, completedAt: now, latencyMs: 178_000,
    },
    {
      id: 'j4', kind: 'image_generation', status: 'failed', attempts: 5, maxAttempts: 5,
      payload: {}, createdAt: now, updatedAt: now, fallbackReason: 'quota',
    },
    {
      id: 'j5', kind: 'video_generation', status: 'fallback_done', attempts: 5, maxAttempts: 5,
      payload: {}, createdAt: now, updatedAt: now, completedAt: now, latencyMs: 240_000,
      fallbackUsed: true, fallbackReason: 'safety',
    },
  ];
}

function withJobs(Story: React.ComponentType): JSX.Element {
  const Wrapped = () => {
    useEffect(() => {
      jobQueue._seed(makeJobs());
    }, []);
    return <Story />;
  };
  return <Wrapped />;
}

const meta: Meta<typeof JobsPanel> = {
  title: 'Generation/JobsPanel',
  component: JobsPanel,
  tags: ['autodocs'],
  decorators: [(Story) => withJobs(Story as React.ComponentType)],
};
export default meta;

type Story = StoryObj<typeof JobsPanel>;

export const Mixed: Story = {};