/**
 * job.worker.ts — Web Worker dedicado a procesar BackgroundJobs.
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.2.
 *
 * Recibe jobs vía postMessage y los ejecuta según su `kind`.
 * Reporta resultado como JOB_COMPLETED o JOB_FAILED (Blob serializado).
 *
 * Lifecycle: self.close() al recibir TERMINATE. El main thread debe
 * SIEMPRE worker.terminate() después de recibir JOB_COMPLETED/JOB_FAILED.
 */

/// <reference lib="webworker" />

import { generateTransitionWithRetry, classifyVeoError } from '../services/gemini/video';
import { generateFallbackVideo, isRecoverableError } from '../services/fallbackStrategy';
import type { BackgroundJob, VeoError } from '../types/jobs';

interface InMsg {
  type: 'EXECUTE' | 'TERMINATE';
  job: BackgroundJob;
}

interface OutMsg {
  type: 'JOB_COMPLETED' | 'JOB_FAILED';
  jobId: string;
  result?: {
    blob: ArrayBuffer;
    mimeType: string;
    fallbackUsed: boolean;
    fallbackReason?: VeoError['code'];
    attempts: number;
    totalLatencyMs: number;
  };
  error?: { message: string; code: string; attemptNumber?: number };
}

declare const self: DedicatedWorkerGlobalScope;

self.addEventListener('message', async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === 'TERMINATE') {
    self.close();
    return;
  }
  if (msg.type !== 'EXECUTE') return;

  const { job } = msg;
  const start = performance.now();
  try {
    if (job.kind === 'video_generation') {
      const result = await executeVideoJob(job);
      const out: OutMsg = {
        type: 'JOB_COMPLETED',
        jobId: job.id,
        result: {
          blob: await result.blob.arrayBuffer(),
          mimeType: result.blob.type || 'video/mp4',
          fallbackUsed: result.fallbackUsed,
          fallbackReason: result.fallbackReason,
          attempts: result.attempts,
          totalLatencyMs: performance.now() - start,
        },
      };
      self.postMessage(out);
      return;
    }
    if (job.kind === 'image_generation') {
      // Stubs para image_generation y tts en S2 (no usados por el flujo del modal).
      throw new Error(`Job kind not implemented in worker: ${job.kind}`);
    }
    if (job.kind === 'tts') {
      throw new Error(`Job kind not implemented in worker: ${job.kind}`);
    }
    throw new Error(`Unknown job kind: ${job.kind}`);
  } catch (err) {
    const veoErr = classifyVeoError(err);
    const out: OutMsg = {
      type: 'JOB_FAILED',
      jobId: job.id,
      error: {
        message: (err as Error).message ?? 'Job failed',
        code: veoErr.code,
        attemptNumber: veoErr.attemptNumber,
      },
    };
    self.postMessage(out);
  }
});

async function executeVideoJob(job: BackgroundJob): Promise<{
  blob: Blob;
  fallbackUsed: boolean;
  fallbackReason?: VeoError['code'];
  attempts: number;
}> {
  const payload = job.payload as {
    transition?: import('../types/transition').KeyframeTransition;
    keyframeFrom?: import('../types/keyframe').Keyframe;
    keyframeTo?: import('../types/keyframe').Keyframe;
    brief?: import('../types/brief').MasterBrief | null;
  };
  if (!payload.transition || !payload.keyframeFrom) {
    throw new Error('video_generation job missing transition or keyframeFrom in payload');
  }
  try {
    const r = await generateTransitionWithRetry(
      payload.transition,
      payload.keyframeFrom,
      payload.keyframeTo ?? payload.keyframeFrom,
    );
    return { blob: r.blob, fallbackUsed: false, attempts: r.attempts };
  } catch (err) {
    const veoErr = classifyVeoError(err);
    if (isRecoverableError(veoErr)) {
      const reason = (['safety', 'quota', 'timeout'] as const).includes(
        veoErr.code as 'safety' | 'quota' | 'timeout',
      )
        ? (veoErr.code as 'safety' | 'quota' | 'timeout')
        : 'unknown';
      const fb = await generateFallbackVideo({
        transition: payload.transition,
        keyframeFrom: payload.keyframeFrom,
        keyframeTo: payload.keyframeTo ?? null,
        reason,
        brief: payload.brief ?? null,
      });
      return {
        blob: fb.blob,
        fallbackUsed: true,
        fallbackReason: veoErr.code,
        attempts: veoErr.attemptNumber ?? job.attempts,
      };
    }
    throw veoErr;
  }
}

export {}; // módulo ES