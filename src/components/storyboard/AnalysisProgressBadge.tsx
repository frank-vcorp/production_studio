/**
 * AnalysisProgressBadge — ARCH-20260704-09 + ARCH-20260705-03.
 * Indicador persistente del estado de análisis Vision para un keyframe.
 * Dos modos:
 *   - isOverlay=false (default, legacy): badge inline pequeño debajo del header.
 *   - isOverlay=true: overlay absoluto con backdrop-blur sobre el thumbnail
 *     (igual que GenerationProgressBadge de Veo 3.1).
 * Lee `analysisJobs.get(keyframeId)` del store y renderiza 4 estados:
 *   - analyzing → spinner + texto
 *   - done      → check + "Análisis listo" (auto-clear 2 s)
 *   - failed    → ícono error + "Falló: <msg>"
 *   - idle|undef → null
 */

import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { AnalysisJob } from '@/types/progressJobs';

interface Props {
  keyframeId: string;
  /** Si true, renderiza overlay absoluto (backdrop-blur sobre el thumbnail). Default false. */
  isOverlay?: boolean;
}

export function AnalysisProgressBadge({ keyframeId, isOverlay = false }: Props) {
  const job = useProjectStore((s) => s.analysisJobs.get(keyframeId));
  const finishAnalysisJob = useProjectStore((s) => s.finishAnalysisJob);

  // Auto-clear 'done' después de 2 s (eliminar del Map).
  useEffect(() => {
    if (!job || job.state !== 'done') return;
    const t = setTimeout(() => {
      // Eliminamos del Map para volver a 'idle' (null render).
      useProjectStore.setState((s) => {
        const next = new Map(s.analysisJobs);
        next.delete(keyframeId);
        return { analysisJobs: next };
      });
      // Llamada vacía a finishAnalysisJob referencia no usada:
      void finishAnalysisJob;
    }, 2000);
    return () => clearTimeout(t);
  }, [job, keyframeId, finishAnalysisJob]);

  if (!job) return null;
  if (isOverlay) return renderOverlay(job);
  return renderBadge(job);
}

function renderOverlay(job: AnalysisJob): JSX.Element | null {
  if (job.state === 'analyzing') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="analysis-overlay-analyzing"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-10"
      >
        <div className="loader-ring" style={{ width: 40, height: 40 }} aria-hidden />
        <p className="text-sm font-bold text-sky-300">Analizando con Gemini Vision…</p>
      </div>
    );
  }
  if (job.state === 'done') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="analysis-overlay-done"
        className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm flex items-center justify-center z-10 pointer-events-none"
      >
        <div className="flex flex-col items-center gap-2">
          <i className="fa-solid fa-circle-check text-3xl text-emerald-300" aria-hidden />
          <p className="text-sm font-bold text-emerald-200">Análisis listo</p>
        </div>
      </div>
    );
  }
  if (job.state === 'failed') {
    return (
      <div
        role="alert"
        data-testid="analysis-overlay-failed"
        className="absolute inset-0 bg-rose-950/50 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 p-4 text-center"
      >
        <i className="fa-solid fa-circle-exclamation text-2xl text-rose-300" aria-hidden />
        <p className="text-xs text-rose-200">
          Falló: {job.errorMessage ?? 'error desconocido'}
        </p>
      </div>
    );
  }
  return null;
}

function renderBadge(job: AnalysisJob): JSX.Element | null {
  if (job.state === 'analyzing') {
    return (
      <div
        data-testid="analysis-progress-analyzing"
        className="flex items-center gap-2 text-[11px] text-sky-300"
        role="status"
        aria-live="polite"
      >
        <span className="loader-ring" style={{ width: 14, height: 14 }} />
        <span>Analizando con Gemini Vision…</span>
      </div>
    );
  }
  if (job.state === 'done') {
    return (
      <div
        data-testid="analysis-progress-done"
        className="flex items-center gap-2 text-[11px] text-emerald-300"
        role="status"
        aria-live="polite"
      >
        <i className="fa-solid fa-circle-check" aria-hidden />
        <span>Análisis listo</span>
      </div>
    );
  }
  if (job.state === 'failed') {
    return (
      <div
        data-testid="analysis-progress-failed"
        className="flex items-center gap-2 text-[11px] text-rose-300"
        role="alert"
      >
        <i className="fa-solid fa-circle-exclamation" aria-hidden />
        <span>Falló: {job.errorMessage ?? 'error desconocido'}</span>
      </div>
    );
  }
  // 'idle' o desconocido: null
  return null;
}