/**
 * Tests para VersionHistory (UI).
 * Spec: SPEC-S4-GRANULAR-EDIT §4.4 — 3 tests mínimos.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionHistory } from '@/components/generation/VersionHistory';
import type { PromptVersion } from '@/types/transition';

function makeVersion(version: number, prompt: string, ts: number): PromptVersion {
  return { version, prompt, approvedAt: ts, approvedBy: 'user' };
}

describe('<VersionHistory />', () => {
  it('Renderiza con 3 versiones → lista visible', () => {
    const versions = [
      makeVersion(1, 'prompt A', Date.now()),
      makeVersion(2, 'prompt B', Date.now() - 60_000),
      makeVersion(3, 'prompt C', Date.now() - 600_000),
    ];
    render(<VersionHistory versions={versions} onRestore={() => undefined} />);
    expect(screen.getByTestId('version-history')).toBeInTheDocument();
    expect(screen.getByTestId('version-0')).toBeInTheDocument();
    expect(screen.getByTestId('version-1')).toBeInTheDocument();
    expect(screen.getByTestId('version-2')).toBeInTheDocument();
  });

  it('Click v3 → onRestore callback con PromptVersion', () => {
    const versions = [
      makeVersion(1, 'prompt A', Date.now()),
      makeVersion(2, 'prompt B', Date.now() - 60_000),
      makeVersion(3, 'prompt C', Date.now() - 600_000),
    ];
    const onRestore = vi.fn();
    render(<VersionHistory versions={versions} onRestore={onRestore} />);
    fireEvent.click(screen.getByTestId('version-2'));
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ version: 3, prompt: 'prompt C' }));
  });

  it('v actual (currentVersionNumber) tiene badge "actual"', () => {
    const versions = [
      makeVersion(1, 'prompt A', Date.now()),
      makeVersion(2, 'prompt B', Date.now() - 60_000),
    ];
    render(
      <VersionHistory versions={versions} currentVersionId={1} onRestore={() => undefined} />,
    );
    expect(screen.getByTestId('version-current-badge-0')).toBeInTheDocument();
    expect(screen.getByTestId('version-current-badge-0')).toHaveTextContent('actual');
    // El segundo (idx=1) NO debe tener badge
    expect(screen.queryByTestId('version-current-badge-1')).not.toBeInTheDocument();
  });

  it('Lista vacía muestra mensaje', () => {
    render(<VersionHistory versions={[]} onRestore={() => undefined} />);
    expect(screen.getByText(/Sin versiones previas/)).toBeInTheDocument();
  });
});