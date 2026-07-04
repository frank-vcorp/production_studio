/**
 * JobsPanel — panel en tiempo real de la cola de jobs (GenerationMonitor).
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.5.
 *
 * Header con progress bar gradient sky→emerald.
 * 4 stat cards: ETA, Activos, Fallos, Tiempo Total.
 * Lista de jobs con StatusIcon, attempts, latency, fallback indicator.
 * Footer con [Cancelar Todo] [Limpiar Completados] [Ir a Export Center].
 */

import { useMemo } from 'react';
import { useJobs } from '@/hooks/useJobs';
import { jobQueue } from '@/services/jobQueue';
import { Button } from '@/components/common/Button';
import { formatDuration } from '@/utils/format';
import type { BackgroundJob, JobStatus } from '@/types/jobs';

interface Props {
  onJumpToExport?: () => void;
}

const DEFAULT_VEO_LATENCY_MS = 180_000;

export function JobsPanel({ onJumpToExport }: Props) {
  const state = useJobs();
  const jobs = state.jobs;

  const stats = useMemo(() => {
    const total = jobs.length;
    const completed = state.completedJobs;
    const failed = state.failedJobs;
    const remaining = total - completed - failed;
    const completedWithLat = jobs.filter((j) => (j.status === 'done' || j.status === 'fallback_done') && j.latencyMs);
    const avgLatency = completedWithLat.length > 0
      ? completedWithLat.reduce((acc, j) => acc + (j.latencyMs ?? 0), 0) / completedWithLat.length
      : DEFAULT_VEO_LATENCY_MS;
    const etaSec = remaining > 0 ? (avgLatency / 1000) * remaining / Math.max(1, state.activeJobs.length) : 0;
    const totalDuration = jobs.reduce((acc, j) => acc + (j.latencyMs ?? 0), 0);
    return { total, completed, failed, remaining, etaSec, totalDuration };
  }, [jobs, state.completedJobs, state.failedJobs, state.activeJobs.length]);

  if (stats.total === 0) return null;

  const progressPct = stats.total === 0 ? 0 : (stats.completed / stats.total) * 100;
  const allDone = stats.completed === stats.total;

  return (
    <section className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold flex items-center gap-2 text-white">
          <i className="fa-solid fa-list-check text-sky-400" /> Lote en Progreso
        </h3>
        <span className="text-xs font-mono bg-slate-800 text-slate-200 px-2 py-1 rounded">
          {stats.completed}/{stats.total} Completados
        </span>
      </header>

      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="ETA" value={formatDuration(stats.etaSec)} icon="fa-clock" color="sky" />
        <Stat label="Activos" value={state.activeJobs.length.toString()} icon="fa-bolt" color="fuchsia" />
        <Stat label="Fallos" value={stats.failed.toString()} icon="fa-triangle-exclamation" color={stats.failed > 0 ? 'red' : 'slate'} />
        <Stat label="Tiempo Total" value={formatDuration(stats.totalDuration / 1000)} icon="fa-hourglass-half" color="slate" />
      </div>

      <ul className="space-y-2">
        {jobs.map((j) => (
          <JobRow key={j.id} job={j} />
        ))}
      </ul>

      <footer className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
        <div className="flex gap-2">
          {state.activeJobs.length > 0 && (
            <Button variant="ghost" size="sm" icon="fa-stop" onClick={() => void jobQueue.cancelAll()}>
              Cancelar Todo
            </Button>
          )}
          {allDone && onJumpToExport && (
            <Button variant="primary" size="sm" icon="fa-arrow-right" onClick={onJumpToExport}>
              Ir a Export Center
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" icon="fa-trash-can" onClick={() => void jobQueue.clearCompleted()}>
          Limpiar Completados
        </Button>
      </footer>
    </section>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const colorClass: Record<string, string> = {
    sky: 'text-sky-400',
    fuchsia: 'text-fuchsia-400',
    red: 'text-rose-400',
    slate: 'text-slate-400',
  };
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-2">
        <i className={`fa-solid ${icon} ${colorClass[color] ?? 'text-slate-400'}`} />
        <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <div className="mt-1 text-base font-mono text-white">{value}</div>
    </div>
  );
}

function JobRow({ job }: { job: BackgroundJob }) {
  const isActive = job.status === 'active';
  const isDone = job.status === 'done' || job.status === 'fallback_done';
  const isFailed = job.status === 'failed';
  const isPaused = job.status === 'paused';
  const isCancelled = job.status === 'cancelled';

  const borderClass = isActive
    ? 'border-sky-500/50'
    : isDone && job.fallbackUsed
      ? 'border-amber-500/60'
      : isFailed
        ? 'border-rose-500/50'
        : isPaused
          ? 'border-slate-600'
          : isCancelled
            ? 'border-slate-800 opacity-60'
            : 'border-slate-800';

  const tooltip = job.fallbackUsed
    ? `Fallback activado: motivo=${job.fallbackReason ?? 'unknown'}. Regenera manualmente cuando la cuota vuelva.`
    : undefined;

  return (
    <li
      className={`bg-slate-950 border ${borderClass} rounded-lg p-3 flex items-center justify-between gap-3 transition-colors`}
      title={tooltip}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <StatusIcon status={job.status} fallbackUsed={job.fallbackUsed ?? false} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{labelFor(job)}</p>
          <p className="text-xs text-slate-400">
            Intentos: <span className="font-mono">{job.attempts}/{job.maxAttempts}</span>
            {job.fallbackUsed && (
              <span className="ml-2 text-amber-400">
                <i className="fa-solid fa-shield-halved mr-1" />
                Fallback ({job.fallbackReason})
              </span>
            )}
            {job.errorMessage && isFailed && (
              <span className="ml-2 text-rose-400 truncate">· {job.errorMessage}</span>
            )}
          </p>
        </div>
      </div>

      <div className="text-right text-xs shrink-0">
        {job.latencyMs && <p className="text-slate-300 font-mono">{formatDuration(job.latencyMs / 1000)}</p>}
        <p className="text-slate-500 font-mono">ID: {job.id.slice(0, 8)}</p>
      </div>

      <div className="flex gap-1 shrink-0">
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            icon="fa-pause"
            onClick={() => void jobQueue.pause(job.id)}
            aria-label="Pausar"
          />
        )}
        {isPaused && (
          <Button
            variant="ghost"
            size="sm"
            icon="fa-play"
            onClick={() => void jobQueue.resume(job.id)}
            aria-label="Reanudar"
          />
        )}
        {(isActive || isPaused) && (
          <Button
            variant="ghost"
            size="sm"
            icon="fa-times"
            onClick={() => void jobQueue.cancel(job.id)}
            aria-label="Cancelar"
          />
        )}
      </div>
    </li>
  );
}

function StatusIcon({ status, fallbackUsed }: { status: JobStatus; fallbackUsed: boolean }) {
  const map: Record<JobStatus, { icon: string; color: string }> = {
    queued: { icon: 'fa-hourglass-start', color: 'text-slate-400' },
    active: { icon: 'fa-spinner', color: 'text-sky-400 animate-spin' },
    paused: { icon: 'fa-pause-circle', color: 'text-slate-500' },
    done: { icon: 'fa-circle-check', color: 'text-emerald-400' },
    failed: { icon: 'fa-circle-xmark', color: 'text-rose-400' },
    fallback_done: { icon: 'fa-shield-halved', color: 'text-amber-400' },
    cancelled: { icon: 'fa-ban', color: 'text-slate-500' },
  };
  const { icon, color } = fallbackUsed && (status === 'done' || status === 'fallback_done')
    ? { icon: 'fa-shield-halved', color: 'text-amber-400' }
    : map[status];
  return <i className={`fa-solid ${icon} ${color} text-base`} aria-hidden />;
}

function labelFor(job: BackgroundJob): string {
  if (job.kind === 'video_generation') {
    const node = job.payload.nodeKey ?? job.transitionId ?? 'video';
    return `Clip ${node}`;
  }
  if (job.kind === 'image_generation') {
    return `Imagen ${job.payload.keyframeId ?? job.keyframeId ?? ''}`;
  }
  if (job.kind === 'tts') {
    return 'TTS';
  }
  return job.kind;
}