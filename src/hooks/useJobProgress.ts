/**
 * Hook reactivo que observa la cola de jobs y dispara la notificación nativa
 * cuando un lote completo termina (todos los jobs done o failed, edge al primer batchId visto).
 *
 * Cierra la observación O1 del checkpoint S3 — antes vivía inline en MasterTab.tsx,
 * ahora vive aquí para testeo aislado y reutilización por otros tabs (PackRRSS en futuro).
 */
import { useEffect, useRef } from 'react';
import { useJobs } from './useJobs';
import { showVideoReadyNotification } from '@/services/notification';

export interface UseJobProgressResult {
  allJobsCompleted: boolean;
  hasPending: boolean;
}

export function useJobProgress(): UseJobProgressResult {
  const state = useJobs();
  const lastBatchIdRef = useRef<string | null>(null);

  const completed = state.completedJobs + state.failedJobs;
  const allDone = state.jobs.length > 0 && completed === state.jobs.length;
  const pending = state.jobs.some(
    (j) => j.status === 'queued' || j.status === 'active' || j.status === 'paused',
  );

  useEffect(() => {
    // batchId estable = primer job.id (todos los jobs de un lote comparten timestamp prefix)
    const batchId = state.jobs[0]?.id ?? null;
    if (allDone && batchId && lastBatchIdRef.current !== batchId) {
      lastBatchIdRef.current = batchId;
      showVideoReadyNotification();
    } else if (!allDone && batchId === null) {
      lastBatchIdRef.current = null;
    }
  }, [allDone, state.jobs]);

  return { allJobsCompleted: allDone, hasPending: pending };
}
