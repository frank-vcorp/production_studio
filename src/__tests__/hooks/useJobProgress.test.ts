/**
 * useJobProgress — edge cases de batchId y notificación.
 * Spec: SPEC-S6-TESTS-CICD §6.1.
 *
 * ID: IMPL-20260704-06.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/services/notification', () => ({
  showVideoReadyNotification: vi.fn(),
}));

import { useJobProgress } from '@/hooks/useJobProgress';
import { showVideoReadyNotification } from '@/services/notification';
import { jobQueue } from '@/services/jobQueue';
import type { BackgroundJob } from '@/types/jobs';

function makeJob(id: string, status: BackgroundJob['status']): BackgroundJob {
  return {
    id,
    kind: 'image_generation',
    status,
    attempts: 0,
    maxAttempts: 5,
    payload: { text: '', voice: 'Kore' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('useJobProgress', () => {
  beforeEach(() => {
    vi.mocked(showVideoReadyNotification).mockClear();
    jobQueue._seed([]);
  });

  it('allJobsCompleted=false cuando no hay jobs', () => {
    const { result } = renderHook(() => useJobProgress());
    expect(result.current.allJobsCompleted).toBe(false);
    expect(result.current.hasPending).toBe(false);
  });

  it('allJobsCompleted=true cuando todos están done', () => {
    jobQueue._seed([
      makeJob('batchA-1', 'done'),
      makeJob('batchA-2', 'done'),
    ]);
    const { result } = renderHook(() => useJobProgress());
    expect(result.current.allJobsCompleted).toBe(true);
    expect(result.current.hasPending).toBe(false);
  });

  it('hasPending=true cuando hay jobs queued/active/paused', () => {
    jobQueue._seed([
      makeJob('batchB-1', 'done'),
      makeJob('batchB-2', 'active'),
    ]);
    const { result } = renderHook(() => useJobProgress());
    expect(result.current.allJobsCompleted).toBe(false);
    expect(result.current.hasPending).toBe(true);
  });

  it('completed incluye done + failed (no pending)', () => {
    jobQueue._seed([
      makeJob('batchC-1', 'done'),
      makeJob('batchC-2', 'failed'),
    ]);
    const { result } = renderHook(() => useJobProgress());
    expect(result.current.allJobsCompleted).toBe(true);
    expect(result.current.hasPending).toBe(false);
  });

  it('completed no incluye cancelled', () => {
    jobQueue._seed([
      makeJob('batchD-1', 'done'),
      makeJob('batchD-2', 'cancelled'),
    ]);
    const { result } = renderHook(() => useJobProgress());
    // cancelled no cuenta como completed, así que allJobsCompleted=false
    expect(result.current.allJobsCompleted).toBe(false);
    expect(result.current.hasPending).toBe(false);
  });
});
