/**
 * AnalysisProgressBadge — ARCH-20260704-09.
 * Indicador persistente del estado de análisis Vision para un keyframe.
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
}

export function AnalysisProgressBadge({ keyframeId }: Props) {
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

  return renderBadge(job);
}

function renderBadge(job: AnalysisJob | undefined): JSX.Element | null {
  if (!job) return null;
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