/**
 * ExportCenter — Storybook catalog.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * 5 tabs (Master, Pack RRSS, Assets, Manifest, Share). El tab "Master" es
 * el default; los demás requieren masterVideo presente.
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { ExportCenter } from '@/components/generation/ExportCenter';
import { useProjectStore } from '@/stores/projectStore';

function withMasterVideo(Story: React.ComponentType): JSX.Element {
  const Wrapped = () => {
    useEffect(() => {
      const blob = new Blob(['mock-mp4'], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      useProjectStore.setState({
        masterVideo: blob,
        masterVideoUrl: url,
      });
    }, []);
    return <Story />;
  };
  return <Wrapped />;
}

const meta: Meta<typeof ExportCenter> = {
  title: 'Generation/ExportCenter',
  component: ExportCenter,
  tags: ['autodocs'],
  decorators: [(Story) => withMasterVideo(Story as React.ComponentType)],
};
export default meta;

type Story = StoryObj<typeof ExportCenter>;

export const WithMaster: Story = {};