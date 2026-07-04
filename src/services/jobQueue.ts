/**
 * JobQueueService — cola persistente en IndexedDB con workers paralelos.
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.2.
 *
 * Características:
 *  - Persistencia en IDB store "jobs" (versión 2, separada del store kv).
 *  - parallelSlots = 3 por defecto (configurable).
 *  - Hidratación: jobs 'active' → 'queued' al cargar (no sabemos si siguen corriendo).
 *  - Suscripción reactiva con subscribe(fn): unsubscribe.
 *  - Sobrevive a refresh: loadPersistedJobs() re-encola automáticamente.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { useProjectStore } from '@/stores/projectStore';
import type {
  BackgroundJob,
  JobKind,
  JobQueueState,
  JobSpec,
  JobStatus,
} from '@/types/jobs';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';

const DB_NAME = 'bridge-jobs';
const STORE = 'jobs';
const DB_VERSION = 1;

interface JobWorkerMessage {
  type: 'JOB_COMPLETED' | 'JOB_FAILED';
  jobId: string;
  result?: {
    blob: ArrayBuffer;
    mimeType: string;
    fallbackUsed: boolean;
    fallbackReason?: string;
    attempts: number;
    totalLatencyMs: number;
  };
  error?: { message: string; code: string; attemptNumber?: number };
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

class JobQueueServiceImpl {
  private jobs: BackgroundJob[] = [];
  private listeners = new Set<(state: JobQueueState) => void>();
  private activeWorkers = new Map<string, Worker>();
  private parallelSlots = 3;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await getDB();
    await this.loadPersistedJobs();
    this.initialized = true;
    this.notify();
  }

  /** Estado reactivo actual (snapshot). */
  getQueueState(): JobQueueState {
    return {
      jobs: [...this.jobs],
      activeJobs: this.jobs.filter((j) => j.status === 'active').map((j) => j.id),
      completedJobs: this.jobs.filter((j) => j.status === 'done' || j.status === 'fallback_done').length,
      failedJobs: this.jobs.filter((j) => j.status === 'failed').length,
      totalStartedAt: this.jobs.reduce<number | undefined>(
        (acc, j) => (j.startedAt ? (acc ? Math.min(acc, j.startedAt) : j.startedAt) : acc),
        undefined,
      ),
      totalCompletedAt: this.jobs.every((j) =>
        j.status === 'done' || j.status === 'fallback_done' || j.status === 'failed' || j.status === 'cancelled',
      )
        ? Date.now()
        : undefined,
    };
  }

  /** Suscripción reactiva. Retorna función de unsubscribe. */
  subscribe(fn: (state: JobQueueState) => void): () => void {
    this.listeners.add(fn);
    // Emitir estado actual inmediatamente
    fn(this.getQueueState());
    return () => this.listeners.delete(fn);
  }

  /** Crea un batch de jobs a partir de specs. Persiste y arranca processNext. */
  async createBatch(specs: JobSpec[]): Promise<string[]> {
    await this.initialize();
    const now = Date.now();
    const newJobs: BackgroundJob[] = specs.map((spec) => {
      const id = `job_${uuidv4().slice(0, 12)}`;
      const base: BackgroundJob = {
        id,
        kind: spec.kind,
        status: 'queued',
        attempts: 0,
        maxAttempts: 5,
        payload: buildPayload(spec),
        createdAt: now,
        updatedAt: now,
      };
      if (spec.kind === 'video_generation') {
        base.transitionId = spec.transitionId;
      } else if (spec.kind === 'image_generation') {
        base.keyframeId = spec.keyframeId;
      }
      return base;
    });

    this.jobs = [...this.jobs, ...newJobs];
    await this.persistAll();
    this.notify();
    // Lanzar processNext
    void this.processNext();
    return newJobs.map((j) => j.id);
  }

  async pause(jobId: string): Promise<void> {
    this.updateJob(jobId, (j) => {
      if (j.status === 'active' || j.status === 'queued') {
        return { ...j, status: 'paused' as JobStatus, updatedAt: Date.now() };
      }
      return j;
    });
    // Si estaba activo, terminamos el worker (queda en pausa, sin matar el progreso).
    this.terminateWorker(jobId);
    await this.persistAll();
    this.notify();
  }

  async resume(jobId: string): Promise<void> {
    this.updateJob(jobId, (j) => {
      if (j.status === 'paused') {
        return { ...j, status: 'queued' as JobStatus, updatedAt: Date.now() };
      }
      return j;
    });
    await this.persistAll();
    this.notify();
    void this.processNext();
  }

  async cancel(jobId: string): Promise<void> {
    this.terminateWorker(jobId);
    this.updateJob(jobId, (j) => ({ ...j, status: 'cancelled' as JobStatus, updatedAt: Date.now() }));
    await this.persistAll();
    this.notify();
    void this.processNext();
  }

  async cancelAll(): Promise<void> {
    for (const [jobId] of this.activeWorkers) this.terminateWorker(jobId);
    this.jobs = this.jobs.map((j) =>
      j.status === 'active' || j.status === 'queued' || j.status === 'paused'
        ? { ...j, status: 'cancelled' as JobStatus, updatedAt: Date.now() }
        : j,
    );
    await this.persistAll();
    this.notify();
  }

  async clearCompleted(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE, 'readwrite');
    for (const j of this.jobs) {
      if (j.status === 'done' || j.status === 'fallback_done' || j.status === 'failed' || j.status === 'cancelled') {
        await tx.store.delete(j.id);
      }
    }
    await tx.done;
    this.jobs = this.jobs.filter(
      (j) => j.status !== 'done' && j.status !== 'fallback_done' && j.status !== 'failed' && j.status !== 'cancelled',
    );
    this.notify();
  }

  /** Slot count para ETA. */
  getParallelSlots(): number {
    return this.parallelSlots;
  }

  setParallelSlots(n: number): void {
    this.parallelSlots = Math.max(1, n);
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private updateJob(id: string, mut: (j: BackgroundJob) => BackgroundJob): void {
    const idx = this.jobs.findIndex((j) => j.id === id);
    if (idx < 0) return;
    this.jobs = [
      ...this.jobs.slice(0, idx),
      mut(this.jobs[idx]),
      ...this.jobs.slice(idx + 1),
    ];
  }

  private notify(): void {
    const state = this.getQueueState();
    for (const fn of this.listeners) {
      try {
        fn(state);
      } catch {
        // ignore
      }
    }
  }

  private async persistAll(): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE, 'readwrite');
      for (const j of this.jobs) {
        await tx.store.put(j);
      }
      await tx.done;
    } catch (e) {
      console.warn('[JobQueue] persistAll failed', e);
    }
  }

  private async loadPersistedJobs(): Promise<void> {
    try {
      const db = await getDB();
      const all = (await db.getAll(STORE)) as BackgroundJob[];
      // Marcar 'active' como 'queued' (no sabemos si siguen vivos tras refresh).
      const requeued = all.map((j) =>
        j.status === 'active' ? { ...j, status: 'queued' as JobStatus, startedAt: undefined } : j,
      );
      this.jobs = requeued;
      // Auto-resume
      if (requeued.some((j) => j.status === 'queued')) {
        // Programar processNext fuera del ciclo de hidratación
        setTimeout(() => void this.processNext(), 100);
      }
    } catch (e) {
      console.warn('[JobQueue] loadPersistedJobs failed', e);
      this.jobs = [];
    }
  }

  /** Procesa el siguiente job si hay slot libre. */
  private async processNext(): Promise<void> {
    const activeCount = this.jobs.filter((j) => j.status === 'active').length;
    if (activeCount >= this.parallelSlots) return;

    const next = this.jobs.find((j) => j.status === 'queued');
    if (!next) return;

    this.updateJob(next.id, (j) => ({
      ...j,
      status: 'active',
      startedAt: Date.now(),
      attempts: j.attempts + 1,
      updatedAt: Date.now(),
    }));
    await this.persistAll();
    this.notify();

    const worker = new Worker(new URL('../workers/job.worker.ts', import.meta.url), { type: 'module' });
    this.activeWorkers.set(next.id, worker);

    const cleanup = (): void => {
      const w = this.activeWorkers.get(next.id);
      if (w) {
        try {
          w.terminate();
        } catch {
          // ignore
        }
        this.activeWorkers.delete(next.id);
      }
    };

    worker.onmessage = (e: MessageEvent<JobWorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'JOB_COMPLETED' && msg.result) {
        const blob = new Blob([msg.result.blob], { type: msg.result.mimeType });
        this.onJobCompleted(next.id, blob, msg.result.fallbackUsed, msg.result.fallbackReason as BackgroundJob['fallbackReason'], msg.result.attempts, msg.result.totalLatencyMs);
      } else if (msg.type === 'JOB_FAILED') {
        this.onJobFailed(next.id, msg.error?.message ?? 'unknown', msg.error?.code, msg.error?.attemptNumber);
      }
      cleanup();
      // Procesar siguiente
      void this.processNext();
    };

    worker.onerror = (e) => {
      console.error('[JobQueue] worker error', e);
      this.onJobFailed(next.id, e.message ?? 'worker error', 'unknown', undefined);
      cleanup();
      void this.processNext();
    };

    worker.postMessage({ type: 'EXECUTE', job: this.jobs.find((j) => j.id === next.id)! });
  }

  private terminateWorker(jobId: string): void {
    const w = this.activeWorkers.get(jobId);
    if (!w) return;
    try {
      w.terminate();
    } catch {
      // ignore
    }
    this.activeWorkers.delete(jobId);
  }

  private async onJobCompleted(
    jobId: string,
    blob: Blob,
    fallbackUsed: boolean,
    fallbackReason: BackgroundJob['fallbackReason'],
    attempts: number,
    totalLatencyMs: number,
  ): Promise<void> {
    // Guardar Blob como URL + base64 en payload, y propagar al projectStore.
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const url = URL.createObjectURL(blob);
    const base64 = await blobToBase64(blob);

    this.updateJob(jobId, (j) => ({
      ...j,
      status: fallbackUsed ? 'fallback_done' : 'done',
      completedAt: Date.now(),
      latencyMs: totalLatencyMs,
      attempts,
      fallbackUsed,
      fallbackReason,
      outputBlobId: url,
      payload: { ...j.payload, outputBase64: base64, outputMimeType: blob.type },
      updatedAt: Date.now(),
    }));

    // Propagar a projectStore para que ExportCenter pueda usar el clip.
    if (job.transitionId) {
      // S6 §6.6: Analytics opt-in — registrar fallback_activated cuando
      // se aplicó fallback (imagen estática o color plano) por safety/quota/timeout.
      if (fallbackUsed && fallbackReason) {
        import('@/services/analytics')
          .then(({ analytics }) => {
            analytics.record({
              type: 'fallback_activated',
              reason: String(fallbackReason),
              ratio: '9:16',
              timestamp: Date.now(),
            });
          })
          .catch(() => undefined);
      }
      useProjectStore.setState((s) => {
        const cur = s.transitions.get(job.transitionId!);
        if (!cur) return s;
        const nextClips = new Map(s.clips);
        nextClips.set(job.transitionId!, blob);
        const nextTransitions = new Map(s.transitions);
        nextTransitions.set(job.transitionId!, {
          ...cur,
          videoBlob: blob,
          videoUrl: url,
          status: 'done',
          generatedAt: Date.now(),
        });
        return { clips: nextClips, transitions: nextTransitions };
      });
    }

    await this.persistAll();
    this.notify();
  }

  private async onJobFailed(
    jobId: string,
    message: string,
    code: string | undefined,
    attemptNumber: number | undefined,
  ): Promise<void> {
    this.updateJob(jobId, (j) => ({
      ...j,
      status: 'failed',
      completedAt: Date.now(),
      errorMessage: message,
      errorCode: code,
      attempts: attemptNumber ?? j.attempts,
      updatedAt: Date.now(),
    }));
    if (code && (code === 'safety' || code === 'quota' || code === 'timeout' || code === 'unknown')) {
      // Marcar fallbackReason aunque no se haya aplicado (sirve para debug).
      this.updateJob(jobId, (j) => ({ ...j, fallbackReason: code }));
    }
    await this.persistAll();
    this.notify();
  }

  /** Test helper: inyecta jobs directamente (sin createBatch). */
  _seed(jobs: BackgroundJob[]): void {
    this.jobs = jobs;
  }

  /** Test helper: snapshot interno. */
  _internalJobs(): BackgroundJob[] {
    return this.jobs;
  }
}

function buildPayload(spec: JobSpec): BackgroundJob['payload'] {
  if (spec.kind === 'video_generation') {
    // Cacheamos solo lo esencial (los Blobs NO se serializan a IDB).
    return {
      transitionId: spec.transitionId,
      nodeKey: spec.transition.nodeKey,
      duration: spec.transition.duration,
      transition: serializeTransition(spec.transition),
      keyframeFrom: serializeKeyframe(spec.keyframeFrom),
      keyframeTo: serializeKeyframe(spec.keyframeTo),
      brief: spec.brief ?? null,
    };
  }
  if (spec.kind === 'image_generation') {
    return {
      keyframeId: spec.keyframeId,
      keyframe: serializeKeyframe(spec.keyframe),
      intent: spec.intent,
      brief: spec.brief ?? null,
    };
  }
  return { text: spec.text, voice: spec.voice };
}

function serializeTransition(t: KeyframeTransition): unknown {
  // No serializar videoBlob (es Blob, no JSON-safe). Solo metadata.
  return {
    id: t.id,
    fromKeyframe: t.fromKeyframe,
    toKeyframe: t.toKeyframe,
    nodeKey: t.nodeKey,
    duration: t.duration,
    prompt: t.prompt,
    promptFinal: t.promptFinal,
    cameraSpec: t.cameraSpec,
    status: t.status,
    veoOperationId: t.veoOperationId,
    generatedAt: t.generatedAt,
  };
}

function serializeKeyframe(k: Keyframe): unknown {
  return {
    id: k.id,
    role: k.role,
    label: k.label,
    description: k.description,
    source: k.source,
    base64: k.base64,
    mimeType: k.mimeType,
    humanIntent: k.humanIntent,
    humanDescription: k.humanDescription,
    cameraSpec: k.cameraSpec,
    timestamp: k.timestamp,
    status: k.status,
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const result = r.result;
      if (typeof result === 'string') {
        const idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      } else {
        reject(new Error('Reader result not string'));
      }
    };
    r.onerror = () => reject(r.error ?? new Error('FileReader failed'));
    r.readAsDataURL(blob);
  });
}

export const jobQueue = new JobQueueServiceImpl();
export type { JobKind };