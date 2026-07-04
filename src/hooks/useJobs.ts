/**
 * useJobs — hook reactivo para el estado de la cola.
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.5.
 */

import { useEffect, useState } from 'react';
import { jobQueue } from '@/services/jobQueue';
import type { JobQueueState } from '@/types/jobs';

export function useJobs(): JobQueueState {
  const [state, setState] = useState<JobQueueState>(() => jobQueue.getQueueState());

  useEffect(() => {
    // Asegurar inicialización lazy
    void jobQueue.initialize();
    const unsub = jobQueue.subscribe(setState);
    return () => {
      unsub();
    };
  }, []);

  return state;
}