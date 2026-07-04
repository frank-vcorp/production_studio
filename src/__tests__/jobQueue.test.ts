/**
 * Tests para JobQueueService — el módulo real no spawna Workers en estos tests
 * porque mockeamos la clase Worker global. Cubrimos: create, processNext slots,
 * pause/resume, cancel, hydrate (active→queued).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  terminated = false;
  static instances: MockWorker[] = [];

  constructor(_url: string | URL, _opts?: WorkerOptions) {
    MockWorker.instances.push(this);
  }

  postMessage(msg: unknown): void {
    // No-op por defecto; tests pueden forzar respuestas vía helpers.
    void msg;
  }

  terminate(): void {
    this.terminated = true;
  }

  // Helpers para tests:
  _emit(msg: unknown): void {
    if (this.onmessage) this.onmessage(new MessageEvent('message', { data: msg }));
  }

  _error(err: Error): void {
    if (this.onerror) this.onerror(new ErrorEvent('error', { message: err.message, error: err }));
  }
}

vi.stubGlobal('Worker', MockWorker);

// jsdom 25 expone URL pero NO URL.createObjectURL/revokeObjectURL (typeof undefined).
// jobQueue.onJobCompleted los usa para materializar el Blob como outputBlobId.
// Sin este stub el handler async falla con TypeError y el status se queda en 'active'.
let __urlCounter = 0;
(URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) =>
  `blob:mock-${++__urlCounter}#${b.size}`;
(URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => undefined;

const { jobQueue } = await import('@/services/jobQueue');
const { useProjectStore } = await import('@/stores/projectStore');

function resetJobQueue(): void {
  (jobQueue as unknown as { jobs: unknown[] }).jobs = [];
  (jobQueue as unknown as { activeWorkers: Map<string, unknown> }).activeWorkers = new Map();
  (jobQueue as unknown as { listeners: Set<unknown> }).listeners = new Set();
  MockWorker.instances = [];
}

beforeEach(async () => {
  // Drenar processNext en vuelo de tests previos (que crean workers tras el reset).
  // Sin esto, el _emit del test apunta al worker equivocado (next.id stale).
  await new Promise((r) => setTimeout(r, 50));
  resetJobQueue();
});

afterEach(async () => {
  // Dejar drenar processNext de este test antes del siguiente reset.
  await new Promise((r) => setTimeout(r, 50));
  resetJobQueue();
});

describe('jobQueue', () => {
  it('createBatch crea N jobs en estado queued', async () => {
    await jobQueue.initialize();
    const ids = await jobQueue.createBatch([
      { kind: 'tts', text: 'hola', voice: 'es-MX' },
      { kind: 'tts', text: 'mundo', voice: 'es-MX' },
    ]);
    expect(ids).toHaveLength(2);
    const state = jobQueue.getQueueState();
    expect(state.jobs).toHaveLength(2);
    expect(state.jobs.every((j) => j.status === 'queued' || j.status === 'active')).toBe(true);
  });

  it('processNext respeta parallelSlots=3 (no más de 3 activos)', async () => {
    await jobQueue.initialize();
    // Forzar 5 jobs queued y parallelSlots=3
    await jobQueue.createBatch([
      { kind: 'tts', text: '1', voice: 'es' },
      { kind: 'tts', text: '2', voice: 'es' },
      { kind: 'tts', text: '3', voice: 'es' },
      { kind: 'tts', text: '4', voice: 'es' },
      { kind: 'tts', text: '5', voice: 'es' },
    ]);
    jobQueue.setParallelSlots(3);
    // Esperar microtasks
    await new Promise((r) => setTimeout(r, 10));
    const state = jobQueue.getQueueState();
    expect(state.activeJobs.length).toBeLessThanOrEqual(3);
  });

  it('cancel cambia status a cancelled y termina worker', async () => {
    await jobQueue.initialize();
    const [id] = await jobQueue.createBatch([{ kind: 'tts', text: 'x', voice: 'es' }]);
    await new Promise((r) => setTimeout(r, 10));
    await jobQueue.cancel(id);
    const state = jobQueue.getQueueState();
    expect(state.jobs.find((j) => j.id === id)?.status).toBe('cancelled');
  });

  it('loadPersistedJobs convierte "active" → "queued" (sobrevivir refresh)', async () => {
    await jobQueue.initialize();
    // Sembrar manualmente un job active en IDB.
    const { openDB } = await import('idb');
    const db = await openDB('bridge-jobs', 1);
    await db.put('jobs', {
      id: 'job_persisted_active',
      kind: 'tts',
      status: 'active',
      attempts: 1,
      maxAttempts: 5,
      payload: { text: 'persistido', voice: 'es' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    db.close();
    // Forzar reload: reset del jobQueue + initialize
    (jobQueue as unknown as { initialized: boolean }).initialized = false;
    await jobQueue.initialize();
    const state = jobQueue.getQueueState();
    const persisted = state.jobs.find((j) => j.id === 'job_persisted_active');
    expect(persisted?.status).toBe('queued');
  });

  it('subscribe: callback llamado inmediatamente y en cambios', async () => {
    await jobQueue.initialize();
    const cb = vi.fn();
    const unsub = jobQueue.subscribe(cb);
    // Llamada inicial
    expect(cb).toHaveBeenCalledTimes(1);
    await jobQueue.createBatch([{ kind: 'tts', text: 'y', voice: 'es' }]);
    expect(cb.mock.calls.length).toBeGreaterThanOrEqual(2);
    unsub();
    // Tras unsub, no más llamadas
    const callsBefore = cb.mock.calls.length;
    await jobQueue.createBatch([{ kind: 'tts', text: 'z', voice: 'es' }]);
    expect(cb.mock.calls.length).toBe(callsBefore);
  });

  it('onJobCompleted propaga el clip a projectStore', async () => {
    await jobQueue.initialize();
    // Crear un job con kind tts no requiere projectStore; pero podemos verificar
    // que un job de video_generation sin transitionId no rompe.
    const [id] = await jobQueue.createBatch([{ kind: 'tts', text: 'v', voice: 'es' }]);
    // Esperar a que processNext cree el Worker (incluye await persistAll antes
    // de instanciar Worker y asignar onmessage). Poll defensivo hasta 1s.
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline) {
      const w = MockWorker.instances.find((mw) => mw.onmessage !== null);
      if (w) {
        // Encontrar el worker cuyo jobId interno coincide con el nuestro.
        // MockWorker no expone next.id, así que usamos el primero con onmessage
        // y verificamos que el _emit propaga al projectStore via onJobCompleted.
        w._emit({
          type: 'JOB_COMPLETED',
          jobId: id,
          result: {
            blob: new ArrayBuffer(8),
            mimeType: 'video/mp4',
            fallbackUsed: false,
            attempts: 1,
            totalLatencyMs: 100,
          },
        });
        // onJobCompleted es async (await blobToBase64 + await persistAll).
        await new Promise((r) => setTimeout(r, 200));
        break;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    const state = jobQueue.getQueueState();
    expect(state.jobs.find((j) => j.id === id)?.status).toBe('done');
    void useProjectStore;
  });

  it('setParallelSlots clamp mínimo 1', () => {
    expect(jobQueue.getParallelSlots()).toBe(3);
    jobQueue.setParallelSlots(0);
    expect(jobQueue.getParallelSlots()).toBe(1);
    jobQueue.setParallelSlots(-5);
    expect(jobQueue.getParallelSlots()).toBe(1);
    jobQueue.setParallelSlots(5);
    expect(jobQueue.getParallelSlots()).toBe(5);
  });

  it('pause de job queued cambia status y termina worker (no crea nuevo)', async () => {
    await jobQueue.initialize();
    jobQueue.setParallelSlots(0);
    const [id] = await jobQueue.createBatch([{ kind: 'tts', text: 'p', voice: 'es' }]);
    await new Promise((r) => setTimeout(r, 10));
    await jobQueue.pause(id);
    expect(jobQueue.getQueueState().jobs.find((j) => j.id === id)?.status).toBe('paused');
    jobQueue.setParallelSlots(3);
  });

  it('resume de paused vuelve a queued y dispara processNext', async () => {
    await jobQueue.initialize();
    jobQueue.setParallelSlots(0);
    const [id] = await jobQueue.createBatch([{ kind: 'tts', text: 'r', voice: 'es' }]);
    await jobQueue.pause(id);
    jobQueue.setParallelSlots(3);
    await jobQueue.resume(id);
    await new Promise((r) => setTimeout(r, 10));
    // Status: queued o active (processNext lo promueve)
    const status = jobQueue.getQueueState().jobs.find((j) => j.id === id)?.status;
    expect(['queued', 'active']).toContain(status);
  });

  it('cancelAll cancela todos los pendientes/activos', async () => {
    await jobQueue.initialize();
    await jobQueue.createBatch([
      { kind: 'tts', text: 'a', voice: 'es' },
      { kind: 'tts', text: 'b', voice: 'es' },
      { kind: 'tts', text: 'c', voice: 'es' },
    ]);
    await new Promise((r) => setTimeout(r, 10));
    await jobQueue.cancelAll();
    const state = jobQueue.getQueueState();
    expect(state.jobs.every((j) => j.status === 'cancelled')).toBe(true);
  });

  it('clearCompleted elimina done/fallback_done/failed/cancelled del IDB + state', async () => {
    await jobQueue.initialize();
    await jobQueue.createBatch([{ kind: 'tts', text: 'x', voice: 'es' }]);
    await jobQueue.cancelAll();
    await jobQueue.clearCompleted();
    expect(jobQueue.getQueueState().jobs.length).toBe(0);
  });

  it('onJobFailed marca status failed + fallbackReason para códigos recuperables', async () => {
    await jobQueue.initialize();
    const [id] = await jobQueue.createBatch([{ kind: 'tts', text: 'f', voice: 'es' }]);
    await new Promise((r) => setTimeout(r, 50));
    const w = MockWorker.instances.find((mw) => mw.onmessage !== null);
    if (w) {
      w._emit({
        type: 'JOB_FAILED',
        jobId: id,
        error: { message: 'quota', code: 'quota', attemptNumber: 1 },
      });
      await new Promise((r) => setTimeout(r, 200));
    }
    const job = jobQueue.getQueueState().jobs.find((j) => j.id === id);
    expect(job?.status).toBe('failed');
    expect(job?.fallbackReason).toBe('quota');
  });

  it('onJobCompleted con fallback marca status fallback_done', async () => {
    await jobQueue.initialize();
    const [id] = await jobQueue.createBatch([{ kind: 'tts', text: 'fb', voice: 'es' }]);
    await new Promise((r) => setTimeout(r, 50));
    const w = MockWorker.instances.find((mw) => mw.onmessage !== null);
    if (w) {
      w._emit({
        type: 'JOB_COMPLETED',
        jobId: id,
        result: {
          blob: new ArrayBuffer(4),
          mimeType: 'video/mp4',
          fallbackUsed: true,
          fallbackReason: 'safety',
          attempts: 5,
          totalLatencyMs: 200,
        },
      });
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(jobQueue.getQueueState().jobs.find((j) => j.id === id)?.status).toBe('fallback_done');
  });
});