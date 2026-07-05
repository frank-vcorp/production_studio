import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AnalysisProgressBadge } from '@/components/storyboard/AnalysisProgressBadge';
import { useProjectStore } from '@/stores/projectStore';
import type { AnalysisJob } from '@/types/progressJobs';

describe('AnalysisProgressBadge (ARCH-20260704-09)', () => {
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