import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AnalysisProgressBadge } from '@/components/storyboard/AnalysisProgressBadge';
import { useProjectStore } from '@/stores/projectStore';
import type { AnalysisJob } from '@/types/progressJobs';

describe('AnalysisProgressBadge — modo legacy (ARCH-20260704-09)', () => {
  beforeEach(() => {
    cleanup();
    useProjectStore.getState().resetProject();
  });

  it('renderiza null cuando no hay job', () => {
    const { container } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza null cuando el job está en idle', () => {
    useProjectStore.setState((s) => {
      const next = new Map(s.analysisJobs);
      const idleJob: AnalysisJob = { keyframeId: 'kf_atencion_in', state: 'idle' };
      next.set('kf_atencion_in', idleJob);
      return { analysisJobs: next };
    });
    const { container } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza spinner + texto cuando el job está analyzing', () => {
    useProjectStore.getState().startAnalysisJob('kf_atencion_in');
    const { getByTestId, getByText } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" />);
    expect(getByTestId('analysis-progress-analyzing')).toBeTruthy();
    expect(getByText(/Analizando con Gemini Vision/i)).toBeTruthy();
    expect(document.querySelector('.loader-ring')).toBeTruthy();
  });

  it('renderiza check + texto cuando el job está done', () => {
    useProjectStore.getState().startAnalysisJob('kf_atencion_in');
    useProjectStore.getState().finishAnalysisJob('kf_atencion_in', true);
    const { getByTestId, getByText } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" />);
    expect(getByTestId('analysis-progress-done')).toBeTruthy();
    expect(getByText(/Análisis listo/i)).toBeTruthy();
  });

  it('renderiza ícono error + Falló cuando el job está failed', () => {
    useProjectStore.getState().startAnalysisJob('kf_atencion_in');
    useProjectStore.getState().finishAnalysisJob('kf_atencion_in', false, 'cuota agotada');
    const { getByTestId, getByText } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" />);
    expect(getByTestId('analysis-progress-failed')).toBeTruthy();
    expect(getByText(/Falló: cuota agotada/i)).toBeTruthy();
  });
});

describe('AnalysisProgressBadge — modo overlay (ARCH-20260705-03)', () => {
  beforeEach(() => {
    cleanup();
    useProjectStore.getState().resetProject();
  });
  afterEach(() => {
    cleanup();
  });

  it('no renderiza nada si no hay job', () => {
    const { container } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" isOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('con state analyzing → renderiza overlay con backdrop-blur', () => {
    useProjectStore.getState().startAnalysisJob('kf_atencion_in');
    const { getByTestId } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" isOverlay />);
    const overlay = getByTestId('analysis-overlay-analyzing');
    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('backdrop-blur-md');
    expect(overlay.className).toContain('absolute');
    expect(overlay.className).toContain('inset-0');
    expect(overlay.textContent).toContain('Analizando con Gemini Vision');
    expect(overlay.getAttribute('role')).toBe('status');
    expect(overlay.getAttribute('aria-live')).toBe('polite');
  });

  it('con state done → renderiza overlay verde', () => {
    useProjectStore.getState().startAnalysisJob('kf_atencion_in');
    useProjectStore.getState().finishAnalysisJob('kf_atencion_in', true);
    const { getByTestId } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" isOverlay />);
    const overlay = getByTestId('analysis-overlay-done');
    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('backdrop-blur-sm');
    expect(overlay.className).toContain('emerald');
    expect(overlay.textContent).toContain('Análisis listo');
  });

  it('con state failed → renderiza overlay rojo con mensaje', () => {
    useProjectStore.getState().startAnalysisJob('kf_atencion_in');
    useProjectStore.getState().finishAnalysisJob('kf_atencion_in', false, 'Your prepayment credits are depleted');
    const { getByTestId } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" isOverlay />);
    const overlay = getByTestId('analysis-overlay-failed');
    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('backdrop-blur-sm');
    expect(overlay.className).toContain('rose');
    expect(overlay.getAttribute('role')).toBe('alert');
    expect(overlay.textContent).toContain('Your prepayment credits are depleted');
  });

  it('con state failed sin errorMessage → muestra "error desconocido"', () => {
    useProjectStore.getState().startAnalysisJob('kf_atencion_in');
    useProjectStore.getState().finishAnalysisJob('kf_atencion_in', false);
    const { getByTestId } = render(<AnalysisProgressBadge keyframeId="kf_atencion_in" isOverlay />);
    const overlay = getByTestId('analysis-overlay-failed');
    expect(overlay.textContent).toContain('error desconocido');
  });
});