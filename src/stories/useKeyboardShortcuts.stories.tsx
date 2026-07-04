/**
 * useKeyboardShortcuts — Storybook catalog.
 * Spec: SPEC-S6-TESTS-CICD §6.4.
 *
 * El hook no renderiza UI; mostramos un panel que demuestra la integración
 * con los atajos reales del hook (Cmd+Enter approve, Cmd+S save, Esc close).
 *
 * ID: IMPL-20260704-06.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

function DemoPanel(): JSX.Element {
  const [lastAction, setLastAction] = useState<string>('(ninguno)');
  useKeyboardShortcuts({
    onApprove: () => setLastAction('Cmd/Ctrl+Enter → Aprobar'),
    onSave: () => setLastAction('Cmd/Ctrl+S → Guardar'),
    onUndo: () => setLastAction('Cmd/Ctrl+Z → Deshacer'),
    onRedo: () => setLastAction('Cmd/Ctrl+Shift+Z → Rehacer'),
    onClose: () => setLastAction('Esc → Cerrar'),
    onCycleTab: (d) => setLastAction(`Tab ${d > 0 ? '+' : '-'} → Cycle ${d}`),
  }, true);
  return (
    <div
      style={{
        background: '#0f172a',
        padding: 24,
        borderRadius: 12,
        color: 'white',
        minWidth: 360,
        fontFamily: 'monospace',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>useKeyboardShortcuts</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
        Presiona <strong>Cmd/Ctrl+Enter</strong>, <strong>Cmd/Ctrl+S</strong>,
        <strong> Esc</strong>, etc.
      </p>
      <div style={{ fontSize: 12 }}>
        Última acción: <span style={{ color: '#38bdf8' }}>{lastAction}</span>
      </div>
    </div>
  );
}

const meta: Meta<typeof DemoPanel> = {
  title: 'Hooks/useKeyboardShortcuts',
  component: DemoPanel,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof DemoPanel>;

export const Demo: Story = {};