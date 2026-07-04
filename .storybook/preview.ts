/**
 * Storybook preview config — fondo oscuro coherente con el tema slate-950.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * ID: IMPL-20260704-06.
 */
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'slate',
      values: [
        { name: 'slate', value: '#0b0f19' },
        { name: 'dark', value: '#020617' },
        { name: 'light', value: '#f8fafc' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
  },
};

export default preview;