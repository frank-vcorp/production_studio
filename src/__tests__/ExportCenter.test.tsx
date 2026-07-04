/**
 * Tests para ExportCenter (UI con tabs) y para MasterTab smoke.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ExportCenter } from '@/components/generation/ExportCenter';
import { useProjectStore } from '@/stores/projectStore';

// Reset del store entre tests
beforeEach(() => {
  useProjectStore.setState((s) => ({
    ...s,
    masterVideo: null,
    masterVideoUrl: null,
    voiceover: null,
    subtitles: null,
    manifest: null,
    brandKit: null,
    transitions: new Map(),
    keyframes: new Map(),
  }));
});

describe('ExportCenter tabs', () => {
  it('renderiza los 5 tabs como buttons', () => {
    render(<ExportCenter />);
    expect(screen.getByTestId('tab-master')).toBeTruthy();
    expect(screen.getByTestId('tab-packRRSS')).toBeTruthy();
    expect(screen.getByTestId('tab-assets')).toBeTruthy();
    expect(screen.getByTestId('tab-manifest')).toBeTruthy();
    expect(screen.getByTestId('tab-share')).toBeTruthy();
  });

  it('Pack RRSS, Assets, Manifest y Share están disabled mientras no hay master', () => {
    render(<ExportCenter />);
    expect(screen.getByTestId('tab-packRRSS')).toBeDisabled();
    expect(screen.getByTestId('tab-assets')).toBeDisabled();
    expect(screen.getByTestId('tab-manifest')).toBeDisabled();
    expect(screen.getByTestId('tab-share')).toBeDisabled();
  });

  it('Master tab es el activo por default', () => {
    render(<ExportCenter />);
    const master = screen.getByTestId('tab-master');
    expect(master.getAttribute('aria-selected')).toBe('true');
  });

  it('al hacer click en otro tab cambia aria-selected', () => {
    useProjectStore.setState((s) => ({
      ...s,
      masterVideo: new Blob(['x'], { type: 'video/mp4' }),
      masterVideoUrl: 'blob:mock/x',
    }));
    render(<ExportCenter />);
    // El tab packRRSS ahora debería estar habilitado (master presente)
    const packBtn = screen.getByTestId('tab-packRRSS') as HTMLButtonElement;
    expect(packBtn.disabled).toBe(false);
    fireEvent.click(packBtn);
    expect(packBtn.getAttribute('aria-selected')).toBe('true');
  });

  it('MasterTab visible cuando está en tab Master: muestra sección de ensamblar', () => {
    render(<ExportCenter />);
    const panel = screen.getByTestId('tab-panel-master');
    // El MasterTab contiene el botón "Ensamblar Master (FFmpeg)"
    expect(within(panel).getByText(/Ensamblar Master/i)).toBeTruthy();
  });
});
