/**
 * GenerationProgressBadge — ARCH-20260704-09.
 * Indicador persistente del estado de generación de clip (Veo 3.1).
 * Lee `generationJobs.get(transitionId)` del store y renderiza 4 estados:
 *   - generating → spinner + ETA dinámico (~X s)
 *   - done       → check + "Clip listo" (auto-clear 3 s)
 *   - failed     → ícono error + "Falló: <msg>" + botón "Reintentar" (placeholder)
 *   - idle|undef → null
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { GenerationJob } from '@/types/progressJobs';

interface Props {
  transitionId: string;
}

export function GenerationProgressBadge({ transitionId }: Props) {
  const job = useProjectStore((s) => s.generationJobs.get(transitionId));

  // ETA dinámico: re-render cada 1 s mientras esté 'generating'.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!job || job.state !== 'generating') return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [job?.state, job]);

  // Auto-clear 'done' después de 3 s.
  useEffect(() => {
    if (!job || job.state !== 'done') return;
    const t = setTimeout(() => {
      useProjectStore.setState((s) => {
        const next = new Map(s.generationJobs);
        next.delete(transitionId);
        return { generationJobs: next };
      });
    }, 3000);
    return () => clearTimeout(t);
  }, [job, transitionId]);

  return renderBadge(transitionId, job);
}

function computeEtaSeconds(job: GenerationJob): number {
  const startedAt = job.startedAt ?? Date.now();
  const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
  // Veo típico 60-120 s, cap 180 s, mínimo 10 s mostrado.
  return Math.max(10, Math.min(180, 90 - elapsedSec));
}

function renderBadge(transitionId: string, job: GenerationJob | undefined): JSX.Element | null {
  if (!job) return null;
  if (job.state === 'generating') {
    const eta = computeEtaSeconds(job);
    return (
      <div
        data-testid="generation-progress-generating"
        className="flex items-center gap-2 text-[11px] text-fuchsia-300"
        role="status"
        aria-live="polite"
      >
        <span className="loader-ring" style={{ width: 14, height: 14 }} />
        <span>
          Generando clip con Veo 3.1… ~{eta}s
        </span>
      </div>
    );
  }
  if (job.state === 'done') {
    return (
      <div
        data-testid="generation-progress-done"
        className="flex items-center gap-2 text-[11px] text-emerald-300"
        role="status"
        aria-live="polite"
      >
        <i className="fa-solid fa-circle-check" aria-hidden />
        <span>Clip listo</span>
      </div>
    );
  }
  if (job.state === 'failed') {
    return (
      <div
        data-testid="generation-progress-failed"
        className="flex items-center gap-2 text-[11px] text-rose-300"
        role="alert"
      >
        <i className="fa-solid fa-circle-exclamation" aria-hidden />
        <span>Falló: {job.errorMessage ?? 'error desconocido'}</span>
        <button
          type="button"
          onClick={() => {
            // Placeholder: ARCH-20260704-09 v1 no implementa reintento,
            // solo expone UI para que el usuario sepa dónde estaría el botón.
            void transitionId;
          }}
          className="ml-1 underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    );
  }
  return null;
}