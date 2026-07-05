import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { GenerationProgressBadge } from '@/components/generation/GenerationProgressBadge';
import { useProjectStore } from '@/stores/projectStore';

describe('GenerationProgressBadge (ARCH-20260704-09)', () => {
  beforeEach(() => {
    cleanup();
    useProjectStore.getState().resetProject();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza null cuando no hay job', () => {
    const { container } = render(<GenerationProgressBadge transitionId="trans_atencion" />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza null cuando el job está en idle', () => {
    useProjectStore.setState((s) => {
      const next = new Map(s.generationJobs);
      next.set('trans_atencion', { transitionId: 'trans_atencion', state: 'idle' });
      return { generationJobs: next };
    });
    const { container } = render(<GenerationProgressBadge transitionId="trans_atencion" />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza spinner + texto ETA cuando el job está generating', () => {
    useProjectStore.getState().startGenerationJob('trans_atencion');
    const { getByTestId, getByText } = render(<GenerationProgressBadge transitionId="trans_atencion" />);
    expect(getByTestId('generation-progress-generating')).toBeTruthy();
    expect(getByText(/Generando clip con Veo 3\.1/i)).toBeTruthy();
    expect(document.querySelector('.loader-ring')).toBeTruthy();
  });

  it('ETA decrece cuando avanza el tiempo simulado', () => {
    const baseTime = 1_700_000_000_000;
    vi.setSystemTime(baseTime);
    useProjectStore.getState().startGenerationJob('trans_atencion');
    const { getByTestId } = render(<GenerationProgressBadge transitionId="trans_atencion" />);

    // Recién iniciado: elapsed ~ 0 → ETA = 90 (cap 180, min 10).
    const initial = getByTestId('generation-progress-generating').textContent ?? '';
    expect(initial).toMatch(/~90s/);

    // Avanzar 50 s (con 1 s extra del interval → elapsed ~ 51, ETA ~ 39).
    act(() => {
      vi.setSystemTime(baseTime + 50_000);
      vi.advanceTimersByTime(1000);
    });
    const after50 = getByTestId('generation-progress-generating').textContent ?? '';
    expect(after50).toMatch(/~3[89]s/);
  });

  it('ETA se mantiene en mínimo 10s si elapsed > 80s', () => {
    const baseTime = 1_700_000_000_000;
    vi.setSystemTime(baseTime);
    useProjectStore.getState().startGenerationJob('trans_atencion');
    const { getByTestId } = render(<GenerationProgressBadge transitionId="trans_atencion" />);

    act(() => {
      vi.setSystemTime(baseTime + 120_000); // 120s elapsed
      vi.advanceTimersByTime(1000);
    });
    const text = getByTestId('generation-progress-generating').textContent ?? '';
    expect(text).toMatch(/~10s/);
  });

  it('renderiza check + Clip listo cuando el job está done', () => {
    useProjectStore.getState().startGenerationJob('trans_atencion');
    useProjectStore.getState().finishGenerationJob('trans_atencion', true, undefined, 1);
    const { getByTestId, getByText } = render(<GenerationProgressBadge transitionId="trans_atencion" />);
    expect(getByTestId('generation-progress-done')).toBeTruthy();
    expect(getByText(/Clip listo/i)).toBeTruthy();
  });

  it('renderiza ícono error + Falló + botón Reintentar cuando el job está failed', () => {
    useProjectStore.getState().startGenerationJob('trans_atencion');
    useProjectStore.getState().finishGenerationJob('trans_atencion', false, 'safety blocked', 1);
    const { getByTestId, getByText } = render(<GenerationProgressBadge transitionId="trans_atencion" />);
    expect(getByTestId('generation-progress-failed')).toBeTruthy();
    expect(getByText(/Falló: safety blocked/i)).toBeTruthy();
    expect(getByText(/Reintentar/i)).toBeTruthy();
  });
});