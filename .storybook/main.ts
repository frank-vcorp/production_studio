/**
 * Storybook main config para Bridge Creative Engine.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * Usa Storybook 8 con framework Vite (sin webpack).
 *
 * ID: IMPL-20260704-06.
 */
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/stories/**/*.stories.@(ts|tsx)',
    '../src/components/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    check: false, // chequeo de tipos se hace en CI por separado
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;