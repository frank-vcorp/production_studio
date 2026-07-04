# SPEC-S2-ROBUSTNESS: Sprint 2 — Robustez Veo + Background Jobs + Costos

**ID:** `IMPL-20260703-02`  
**Fecha:** 2026-07-03  
**Estado:** `[ ] Planificado` → `[~] En Progreso`  
**Dependencia:** S1 ✓ Completado  
**Duración Estimada:** 4-5 horas  
**Responsable:** SOFIA (delegación)  
**Auditor:** GEMINI (Post-S2)  
**Handoff:** `context/interconsultas/S2-handoff.md`

---

## 🎯 ENTREGABLE DEMOSTRABLE (Definition of Done)

> **Sistema completo funcionando:**
>
> 1. Usuario llega a **Storyboard** con 6 keyframes aprobados (mínimo 4 reales)
> 2. Click **"Generar Lote Completo (6 clips)"**
> 3. **Modal Cost Estimator** abre con desglose exacto:
>    ```
>    ╔════════════════════════════════════════════════════════╗
>    ║   Estimación de Costo del Lote                        ║
>    ╠════════════════════════════════════════════════════════╣
>    ║   6× Clips Veo 3.1 (I2V) ............... $2.40 USD    ║
>    ║   3× Imágenes 3 (OUT auto) ............. $0.06 USD    ║
>    ║   1× Voiceover TTS (30s) .............. $0.03 USD    ║
>    ║   1× Token processing (LLM brief) ..... $0.05 USD    ║
>    ║   ─────────────────────────────────────────────────   ║
>    ║   TOTAL ESTIMADO ...................... $2.54 USD    ║
>    ║   ETA TOTAL ........................... ~8-12 min    ║
>    ║                                                        ║
>    ║   ⚠️  Tu API key tiene cuota suficiente.              ║
>    ║                                                        ║
>    ║        [Cancelar]   [Confirmar y Generar]             ║
>    ╚════════════════════════════════════════════════════════╝
>    ```
> 4. **BackgroundJobQueue** inicia con 6 jobs en paralelo
> 5. **Sobrevive a refresh:** Cierra pestaña → Reabre → Job persiste → Continúa sin perder progreso
> 6. **Panel "Jobs" en tiempo real** muestra per-clip:
>    ```
>    ✅ Bumper (KF0→KF1)              [10s, $0.40]   Completado
>    🔄 Atención (KF1→KF1_OUT)        [3m 40s, $0.40] Renderizando ETA 1m
>    ⏳ Interés (KF2→KF2_OUT)         [—, $0.40]     En cola
>    ⏳ Deseo (KF3→KF3_OUT)           [—, $0.40]     En cola
>    ⏳ Acción (KF4→KF5)              [—, $0.40]     En cola
>    ⏳ CTA (KF4→KF5)                 [—, $0.40]     En cola
>    ```
> 7. **Notification API nativa** al terminar: "🎬 Tu video publicitario está listo"
> 8. Si Veo **falla por safety/quota**: Reintento 3x → Fallback a Imagen 3 con transición simple → Usuario notificado del fallback
> 9. **ETA real** se calcula con promedio móvil de latencia de operaciones completadas
> 10. **Costo real** registrado al final vs estimado inicial (+/- 15% tolerancia)

---

## 📋 BACKLOG DETALLADO DE TAREAS S2

| # | Tarea | Criterio de Aceptación | Esfuerzo |
|---|-------|------------------------|----------|
| **2.1** | `CostEstimator` con pricing hardcoded + token estimation | Modal calcula costo exacto antes de generar | M |
| **2.2** | `BackgroundJobQueue` en IndexedDB + hidratación on load | Cierra/abre pestaña → job continúa desde último estado | L |
| **2.3** | `VeoClient` robusto: safety parsing + quota 429 + backoff 5x | Maneja 429 sin romper, retry exponencial 1s-32s | M |
| **2.4** | `FallbackStrategy` automática: Veo fail → Imagen 3 + transición simple | Log muestra "Fallback activado" cuando aplica | M |
| **2.5** | `GenerationMonitor` UI: por-clip progress + ETA real + pause/cancel/live preview | Panel actualiza cada 5s con ETA calculado | L |
| **2.6** | `Notification API` + `Service Worker` mensaje | Notificación nativa aparece al completar job | S |

**Esfuerzo:** S=1h, M=2h, L=3h | **Total:** 4-5h

---

## 🏗️ ARQUITECTURA DETALLADA

### Diagrama de Flujo Post-Click "Generar Lote"

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FLUJO S2                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [CLICK "Generar Lote"]                                                       │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────┐                                               │
│  │  CostEstimatorModal      │                                                │
│  │  • Calcula pricing hardcoded                                                 │
│  │  • Optional: check quota via proxy GET /quota                                │
│  │  • Muestra ETA histórico                                                       │
│  └────────┬─────────────────┘                                                │
│           │ [Confirmar]                                                        │
│           ▼                                                                    │
│  ┌─────────────────────────────────────────────┐                            │
│  │  BackgroundJobQueue.createBatch(6 jobs)    │                            │
│  │  • One job per transition                   │                            │
│  │  • Persiste en IndexedDB store jobQueue     │                            │
│  │  • Marca activeJobs (no bloquea UI)         │                            │
│  └────────┬────────────────────────────────────┘                            │
│           │                                                                    │
│           ▼                                                                    │
│  ┌────────────────────────────────────────────────┐                          │
│  │  Para cada job (paralelo, max 3 concurrent):  │                          │
│  │  ┌──────────────────────────────────────────┐  │                          │
│  │  │ 1. Mark status='active'                  │  │                          │
│  │  │ 2. Try veo.generateTransition()           │  │                          │
│  │  │   ├─ retry 1: backoff 1s                 │  │                          │
│  │  │   ├─ retry 2: backoff 2s                 │  │                          │
│  │  │   ├─ retry 3: backoff 4s                 │  │                          │
│  │  │   ├─ retry 4: backoff 8s                 │  │                          │
│  │  │   ├─ retry 5: backoff 16s (max 32s)     │  │                          │
│  │  │ 3. Si falla safety/cuota → FallbackStrategy:         │                  │
│  │  │   • Genera keyframe_out con Imagen 3 (prompt simplificado)              │
│  │  │   • Crea video estático 4-7s con imagen + zoom suave                    │
│  │  │   • Marca transition.fallback=true                                       │
│  │  │ 4. Si exitoso: store clip, mark 'done', emit completion event           │
│  │  │ 5. Update progress (latencyMs, attempt count, fallback flag)            │
│  │  └──────────────────────────────────────────┘  │                          │
│  └────────┬────────────────────────────────────┘                          │
│           │                                                                    │
│           ▼                                                                    │
│  ┌─────────────────────────────────────────────┐                            │
│  │  GenerationMonitor (suscribe a jobQueue)    │                            │
│  │  • Render UI cada 5s                        │                            │
│  │  • Calculate ETA = (avg latency completed) × remaining │               │
│  │  • Show per-job: status, attempts, ETA, latency, cost │                  │
│  └─────────────────────────────────────────────┘                            │
│                                                                              │
│  [ALL JOBS DONE]                                                              │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────┐                            │
│  │  Notification API                           │                            │
│  │  • showNotification('🎬 Video listo')        │                            │
│  │  • Click → focus tab + open ExportCenter    │                            │
│  │  • Triggered via Service Worker postMessage │                            │
│  └─────────────────────────────────────────────┘                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 ESPECIFICACIÓN DETALLADA POR TAREA

### TAREA 2.1 — CostEstimator

**Archivos nuevos:**
- `src/services/costEstimator.ts` (lógica)
- `src/components/generation/CostEstimatorModal.tsx` (UI)

**API:**

```typescript
// src/services/costEstimator.ts
export type PricingTier = 'free' | 'tier1' | 'tier2' | 'tier3';

export interface CostBreakdown {
  videoClips: { count: number; unitPrice: number; subtotal: number };
  imageGeneration: { count: number; unitPrice: number; subtotal: number };
  tts: { durationSec: number; unitPricePerSec: number; subtotal: number };
  llm: { tokens: number; unitPricePer1k: number; subtotal: number };
  music?: { durationSec: number; unitPricePerSec: number; subtotal: number };
  total: number;
  currency: 'USD';
  estimatedTotalTimeSec: number;
  pricingTier: PricingTier;
  disclaimer: string;
}

export interface CostEstimatorInput {
  transitions: KeyframeTransition[]; // Para contar clips
  keyframesNeedGeneration: Keyframe[]; // OUT a generar
  voiceoverText: string;
  voiceoverDurationSec: number;
  brief: MasterBrief | null;
}

export const PRICING_TABLE = {
  // Gemini API pricing as of 2026-07
  veo: 0.40, // USD per clip 7s
  imagen3: 0.02, // USD per image generated
  ttsPerSec: 0.001, // USD per second of audio
  llmPer1kTokens: 0.00125, // Gemini 2.5 Pro input
  // Estimates históricos (para ETA)
  avgVeoLatencySec: 180, // 3 min promedio
  avgImagenLatencySec: 8,
  avgTTSLatencySec: 4,
};

export const PRICING_DISCLAIMER = `
⚠️ Los precios son estimados basados en la tabla pública de Google.
El costo real puede variar según duración efectiva, reintentos por safety, y tokens consumidos.
Configura tu API key en Google Cloud para ver el costo exacto.
`.trim();

export function estimateCost(input: CostEstimatorInput): CostBreakdown;
export function formatCost(cost: CostBreakdown): string; // "$2.54 USD"
export function estimateETA(cost: CostBreakdown, parallelSlots: number = 3): number; // seconds
```

**UI Modal:**

```tsx
// src/components/generation/CostEstimatorModal.tsx
interface CostEstimatorModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  input: CostEstimatorInput;
  parallelSlots?: number;
}
```

**Layout:**
- Icon shield-money (sky-400)
- Header "Estimación de Costo del Lote"
- Tabla con cada línea + subtotal + total bold
- ETA estimado: icon clock + "ETA TOTAL: ~8-12 min"
- Warning si >$5 USD o ETA >20 min (requiere doble confirmación)
- Footer: [Cancelar] [Confirmar y Generar]

**Tests obligatorios:**
```typescript
// src/__tests__/costEstimator.test.ts
- estimateCost con 6 transitions + 3 KF auto-gen + TTS 30s + brief 1k tokens → total correcto
- formatCost retorna "$2.54 USD"
- estimateETA con 6 jobs paralelos 3 slots → ~7-9 min (no 18 min serial)
- Disclaimers presentes en breakdown.cost
```

---

### TAREA 2.2 — BackgroundJobQueue

**Archivos nuevos:**
- `src/services/jobQueue.ts` (lógica core)
- `src/types/jobs.ts` (ya existe en S1 — ampliar)
- `src/components/generation/JobsPanel.tsx` (UI)
- `src/workers/job.worker.ts` (Web Worker dedicado)

**Tipos ampliados:**

```typescript
// src/types/jobs.ts (ampliar)
export type JobKind = 'video_generation' | 'image_generation' | 'tts' | 'export' | 'fallback';
export type JobStatus = 'queued' | 'active' | 'paused' | 'done' | 'failed' | 'fallback_done' | 'cancelled';

export interface BackgroundJob {
  id: string;
  kind: JobKind;
  status: JobStatus;
  // Inputs
  transitionId?: string;
  keyframeId?: string;
  payload: any; // Specific per kind
  // Tracking
  attempts: number;
  maxAttempts: number;
  latencyMs?: number;
  startedAt?: number;
  completedAt?: number;
  // Error info
  errorMessage?: string;
  errorCode?: string;
  fallbackUsed?: boolean;
  fallbackReason?: 'safety' | 'quota' | 'timeout' | 'unknown';
  // Result
  outputBlobId?: string; // Index into store.clips
  // Metadata
  createdAt: number;
  updatedAt: number;
}

export interface JobQueueState {
  jobs: BackgroundJob[]; // FIFO
  activeJobs: Set<string>; // IDs currently running (max 3)
  completedJobs: number;
  failedJobs: number;
  totalStartedAt?: number;
  totalCompletedAt?: number;
}
```

**API:**

```typescript
// src/services/jobQueue.ts
export class JobQueueService {
  private store: IDBPDatabase<...>;
  private activeWorkers: Map<string, Worker>;
  private parallelSlots: number = 3;
  private listener?: (queue: JobQueueState) => void;
  
  async initialize(): Promise<void>; // Abre IDB + hidrata cola
  async createBatch(jobsSpec: JobSpec[]): Promise<string[]>; // IDs creados
  async pause(jobId: string): Promise<void>;
  async resume(jobId: string): Promise<void>;
  async cancel(jobId: string): Promise<void>;
  async cancelAll(): Promise<void>;
  async clearCompleted(): Promise<void>;
  subscribe(fn: (queue: JobQueueState) => void): () => void; // Unsubscribe
  getQueueState(): JobQueueState;
  private async processNext(): Promise<void>; // Internal
  private async executeJob(job: BackgroundJob): Promise<void>;
  private async persistJobs(): Promise<void>;
  private async loadPersistedJobs(): Promise<void>;
}

export type JobSpec =
  | { kind: 'video_generation'; transitionId: string }
  | { kind: 'image_generation'; keyframeId: string }
  | { kind: 'tts'; text: string; voice: string };
```

**Implementación clave:**

```typescript
// src/workers/job.worker.ts — Procesa un job y reporta resultado
self.onmessage = async (e: MessageEvent<{job: BackgroundJob}>) => {
  const { job } = e.data;
  const start = performance.now();
  
  try {
    let resultBlob: Blob;
    let fallbackUsed = false;
    
    if (job.kind === 'video_generation') {
      try {
        resultBlob = await veoClient.generateTransition(job.payload.transition);
      } catch (veoError) {
        // Fallback strategy
        if (isRecoverableError(veoError)) {
          resultBlob = await generateFallbackVideo(job);
          fallbackUsed = true;
        } else {
          throw veoError;
        }
      }
    }
    // ... other kinds
    
    self.postMessage({
      type: 'JOB_COMPLETED',
      jobId: job.id,
      resultBlob,
      latencyMs: performance.now() - start,
      fallbackUsed,
    });
  } catch (err) {
    self.postMessage({
      type: 'JOB_FAILED',
      jobId: job.id,
      error: (err as Error).message,
    });
  }
};

// En main thread:
async executeJob(job: BackgroundJob): Promise<void> {
  const worker = new Worker(new URL('../workers/job.worker.ts', import.meta.url), { type: 'module' });
  this.activeWorkers.set(job.id, worker);
  
  worker.onmessage = (e) => {
    const { type } = e.data;
    if (type === 'JOB_COMPLETED' || type === 'JOB_FAILED') {
      this.persistJobs();
      this.notifySubscribers();
      worker.terminate();
      this.activeWorkers.delete(job.id);
      this.processNext(); // Process next job in queue
    }
  };
  
  worker.postMessage({ job });
}
```

**Hidratación (sobrevivir refresh):**

```typescript
async loadPersistedJobs(): Promise<void> {
  const all = await this.store.getAll('jobs');
  const pending = all.filter(j => 
    j.status === 'queued' || j.status === 'active' || j.status === 'paused'
  );
  
  // Mark 'active' as 'queued' (we don't know if they're actually running)
  for (const job of pending) {
    if (job.status === 'active') {
      job.status = 'queued';
      job.startedAt = undefined;
    }
  }
  
  this.jobs = pending;
  await this.persistJobs();
  
  // Auto-resume on load
  if (pending.length > 0) {
    this.processNext();
  }
}
```

**Tests obligatorios:**
```typescript
// src/__tests__/jobQueue.test.ts
- createBatch con 6 jobs → cola con 6 items, status='queued'
- processNext() respeta parallelSlots=3 (max 3 active simultáneos)
- pause/resume funciona (status 'active' → 'paused' → 'queued' → 'active')
- cancel cambia status a 'cancelled' y worker.terminate()
- loadPersistedJobs convierte 'active' → 'queued' (sobrevivir refresh)
- subscribe pattern: callback llamado en cambios
```

---

### TAREA 2.3 — VeoClient Robusto

**Archivos ampliados:**
- `src/services/gemini/video.ts` (extender `generateTransition` + retry + safety parsing)

**Mejoras obligatorias:**

```typescript
// src/services/gemini/video.ts (S2 additions)

export interface VeoError extends Error {
  code: 'safety' | 'quota' | 'timeout' | 'network' | 'unknown';
  retryable: boolean;
  attemptNumber?: number;
  details?: any;
}

export function classifyVeoError(err: any): VeoError {
  const status = err.status ?? 0;
  const message = err.message ?? String(err);
  
  if (status === 429 || message.includes('quota')) {
    return Object.assign(new Error('Gemini quota exceeded'), { code: 'quota', retryable: true });
  }
  if (status === 400 && message.toLowerCase().includes('safety')) {
    return Object.assign(new Error('Content blocked by safety filter'), { code: 'safety', retryable: false });
  }
  if (status === 408 || message.includes('timeout')) {
    return Object.assign(new Error('Operation timeout'), { code: 'timeout', retryable: true });
  }
  if (status >= 500 || message.includes('network')) {
    return Object.assign(new Error('Upstream error'), { code: 'network', retryable: true });
  }
  return Object.assign(new Error('Unknown error'), { code: 'unknown', retryable: false });
}

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000]; // 5 attempts total

export async function generateTransitionWithRetry(
  transition: KeyframeTransition,
  keyframeFrom: Keyframe,
  onAttempt?: (attempt: number, totalLatencyMs: number) => void
): Promise<{ blob: Blob; attempts: number; totalLatencyMs: number }> {
  let lastError: VeoError | null = null;
  const start = performance.now();
  
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      onAttempt?.(attempt, performance.now() - start);
      
      // Verify approval gate (per ADR-04 — never bypass)
      if (transition.status !== 'approved') {
        throw new Error(`Transition not approved (status: ${transition.status})`);
      }
      
      const blob = await generateTransition(transition, keyframeFrom);
      return { blob, attempts: attempt, totalLatencyMs: performance.now() - start };
    } catch (err) {
      lastError = classifyVeoError(err);
      lastError.attemptNumber = attempt;
      
      console.warn(`[VeoClient] Attempt ${attempt} failed:`, lastError.code, lastError.message);
      
      if (!lastError.retryable) {
        // Non-retryable (e.g., safety block) → throw immediately
        throw lastError;
      }
      
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt - 1];
        console.log(`[VeoClient] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}
```

**Tests obligatorios:**
```typescript
// src/__tests__/geminiVideo.test.ts
- classifyVeoError mapea status 429 → 'quota', 'safety' en 400 → 'safety', etc.
- generateTransitionWithRetry reintenta 5 veces en errores retryable
- generateTransitionWithRetry throwea inmediato en 'safety' (retryable=false)
- generateTransitionWithRetry respeta approval gate (throw si status !== 'approved')
- onAttempt callback llamado en cada intento
```

---

### TAREA 2.4 — FallbackStrategy

**Archivos nuevos:**
- `src/services/fallbackStrategy.ts`

**Estrategia de Fallback Jerárquica:**

```typescript
// src/services/fallbackStrategy.ts
import { geminiClient } from './gemini/client';
import { generateKeyframeOut } from './gemini/keyframeGenerator';
import { ffmpegService } from './ffmpeg';

export interface FallbackResult {
  blob: Blob;
  strategy: 'imagen3_static' | 'imagen3_blur_zoom' | 'plain_color_with_text';
  reason: 'safety' | 'quota' | 'timeout' | 'unknown';
  generationLog: string[];
}

export async function generateFallbackVideo(
  transition: KeyframeTransition,
  keyframeFrom: Keyframe,
  keyframeTo: Keyframe | null,
  reason: 'safety' | 'quota' | 'timeout' | 'unknown'
): Promise<FallbackResult> {
  const log: string[] = [`Fallback activado: motivo=${reason}`];
  
  try {
    // Strategy 1: Static image with subtle zoom (7s, ffprobe-friendly)
    log.push('Strategy 1: Static image with slow zoom');
    const baseImage = keyframeFrom.base64 || (await generateKeyframeOut(keyframeFrom, transition.nodeKey, null, null)).base64;
    const blob = await ffmpegService.staticVideoFromImage(baseImage!, transition.duration);
    log.push('Success: Static video generated');
    return { blob, strategy: 'imagen3_blur_zoom', reason, generationLog: log };
  } catch (e1) {
    log.push(`Strategy 1 failed: ${(e1 as Error).message}`);
    
    try {
      // Strategy 2: Plain color with brand overlay (last resort)
      log.push('Strategy 2: Plain color with subtitle');
      const blob = await ffmpegService.staticColorWithText('#0b0f19', transition.duration, transition.nodeKey.toUpperCase());
      return { blob, strategy: 'plain_color_with_text', reason, generationLog: log };
    } catch (e2) {
      log.push(`Strategy 2 failed: ${(e2 as Error).message}`);
      throw new Error(`All fallback strategies failed. Logs: ${log.join(' | ')}`);
    }
  }
}

export function isRecoverableError(err: VeoError): boolean {
  // Safety errors → fallback, quota/timeout → retry+fallback
  return ['safety', 'quota', 'timeout', 'unknown'].includes(err.code);
}
```

**Integración con JobQueue:**
```typescript
// En executeJob (jobQueue.ts)
if (job.kind === 'video_generation') {
  try {
    resultBlob = await generateTransitionWithRetry(...).then(r => r.blob);
  } catch (err) {
    const veoErr = classifyVeoError(err);
    if (isRecoverableError(veoErr)) {
      log.warn(`[Job ${job.id}] Veo failed, attempting fallback...`, veoErr.code);
      const fallback = await generateFallbackVideo(transition, kfFrom, kfTo, veoErr.code);
      resultBlob = fallback.blob;
      fallbackUsed = true;
      fallbackReason = veoErr.code;
    } else {
      throw err; // Unrecoverable
    }
  }
}
```

**Nota IMPORTANTE en `ExportCenter.tsx`:** Cuando un clip cae en fallback, en el master final debe mostrarse un pequeño indicator visual (icono warning) en el storyboard para que el usuario sepa qué clips son fallback y puedan regenerarlos cuando la cuota vuelva.

**Tests obligatorios:**
```typescript
// src/__tests__/fallbackStrategy.test.ts
- generateFallbackVideo con reason='safety' genera imagen estática
- isRecoverableError reconoce safety/quota/timeout/unknown como recuperables
- Strategy 2 (plain color) funciona cuando Strategy 1 falla
- Retorna generationLog completo para debugging
```

---

### TAREA 2.5 — GenerationMonitor UI

**Archivos nuevos:**
- `src/components/generation/GenerationMonitor.tsx`
- `src/components/generation/JobsPanel.tsx`
- `src/hooks/useJobs.ts`

**Componente:**

```tsx
// src/components/generation/JobsPanel.tsx
interface JobsPanelProps {
  onJumpToExport: () => void; // When all done
}

function JobsPanel({ onJumpToExport }: JobsPanelProps) {
  const queueState = useJobs(); // Suscripción al store
  
  const totalDuration = queueState.jobs.reduce((acc, j) => acc + (j.latencyMs || 0), 0);
  const completed = queueState.jobs.filter(j => j.status === 'done').length;
  const failed = queueState.failedJobs;
  const remaining = queueState.jobs.length - completed - failed;
  
  // ETA: avg latency of completed × remaining / parallel slots
  const completedJobs = queueState.jobs.filter(j => j.status === 'done' && j.latencyMs);
  const avgLatency = completedJobs.length > 0
    ? completedJobs.reduce((acc, j) => acc + (j.latencyMs!), 0) / completedJobs.length
    : 180_000; // default 3 min
  const etaSec = remaining > 0 ? (avgLatency / 1000 * remaining / queueState.activeJobs.size) : 0;
  
  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <i className="fa-solid fa-list-check text-sky-400"></i>
          Lote en Progreso
        </h3>
        <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded">
          {completed}/{queueState.jobs.length} Completados
        </span>
      </header>
      
      {/* Progress bar */}
      <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${(completed / queueState.jobs.length) * 100}%` }}
        />
      </div>
      
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mt-4">
        <Stat label="ETA" value={formatDuration(etaSec)} icon="clock" color="sky" />
        <Stat label="Activos" value={queueState.activeJobs.size.toString()} icon="bolt" color="fuchsia" />
        <Stat label="Fallos" value={failed.toString()} icon="triangle-exclamation" color={failed > 0 ? 'red' : 'slate'} />
        <Stat label="Tiempo Total" value={formatDuration(totalDuration / 1000)} icon="hourglass" color="slate" />
      </div>
      
      {/* Per-job list */}
      <ul className="mt-6 space-y-2">
        {queueState.jobs.map(job => (
          <JobRow key={job.id} job={job} />
        ))}
      </ul>
      
      {/* Footer actions */}
      <footer className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          {queueState.activeJobs.size > 0 && (
            <button 
              onClick={() => jobQueue.cancelAll()}
              className="btn-secondary text-xs"
            >
              <i className="fa-solid fa-stop mr-1"></i> Cancelar Todo
            </button>
          )}
          {completed === queueState.jobs.length && (
            <button onClick={onJumpToExport} className="btn-primary text-xs">
              <i className="fa-solid fa-arrow-right mr-1"></i> Ir a Export Center
            </button>
          )}
        </div>
        <button onClick={() => jobQueue.clearCompleted()} className="btn-ghost text-xs">
          <i className="fa-solid fa-trash-can mr-1"></i> Limpiar Completados
        </button>
      </footer>
    </div>
  );
}

function JobRow({ job }: { job: BackgroundJob }) {
  const isActive = job.status === 'active';
  const isDone = job.status === 'done' || job.status === 'fallback_done';
  const isFailed = job.status === 'failed';
  
  return (
    <li className={`
      bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between
      ${isActive ? 'border-sky-500/50' : ''}
      ${isDone && job.fallbackUsed ? 'border-amber-500/50' : ''}
    `}>
      <div className="flex items-center gap-3">
        <StatusIcon status={job.status} fallbackUsed={job.fallbackUsed} />
        <div>
          <p className="text-sm font-semibold text-white">{getJobLabel(job)}</p>
          <p className="text-xs text-slate-400">
            Intentos: {job.attempts}/{job.maxAttempts}
            {job.fallbackUsed && (
              <span className="ml-2 text-amber-400">
                <i className="fa-solid fa-fallback"></i> Fallback activado ({job.fallbackReason})
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="text-right text-xs">
        {job.latencyMs && (
          <p className="text-slate-300 font-mono">{formatDuration(job.latencyMs / 1000)}</p>
        )}
        <p className="text-slate-500">Job ID: {job.id.slice(0, 8)}</p>
      </div>
      {/* Per-job actions */}
      <div className="flex gap-1">
        {isActive && (
          <button className="btn-ghost text-xs" title="Pausar">
            <i className="fa-solid fa-pause"></i>
          </button>
        )}
        {(isActive || job.status === 'paused') && (
          <button className="btn-ghost text-xs" title="Cancelar">
            <i className="fa-solid fa-times"></i>
          </button>
        )}
      </div>
    </li>
  );
}
```

**Hook de suscripción:**

```typescript
// src/hooks/useJobs.ts
import { useEffect, useState } from 'react';
import { jobQueue } from '@/services/jobQueue';

export function useJobs() {
  const [state, setState] = useState(jobQueue.getQueueState());
  
  useEffect(() => {
    const unsubscribe = jobQueue.subscribe(setState);
    return unsubscribe;
  }, []);
  
  return state;
}
```

**Tests obligatorios (Vitest + Testing Library):**

```typescript
// src/__tests__/JobsPanel.test.tsx
- Renderiza con 6 jobs pendientes → muestra "0/6 Completados"
- Renderiza con 3 done, 3 active → muestra "3/6", ETA realista
- Job con fallbackUsed=true tiene borde amber
- Click "Cancelar Todo" → jobQueue.cancelAll() llamado
- Cuando completed===total → botón "Ir a Export" visible
```

---

### TAREA 2.6 — Notification API + Service Worker

**Archivos nuevos:**
- `public/sw.js` — Service Worker (en raíz public, no en src/)
- `src/services/notification.ts`

**Service Worker:**

```javascript
// public/sw.js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

**Notification Service:**

```typescript
// src/services/notification.ts
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

export function showVideoReadyNotification(): void {
  if (Notification.permission !== 'granted') return;
  
  const n = new Notification('🎬 Tu video publicitario está listo', {
    body: 'Click para ver el resultado final en el Export Center',
    icon: '/icon.png',
    badge: '/badge.png',
    tag: 'video-ready',
    requireInteraction: true,
  });
  
  n.onclick = () => {
    window.focus();
    // Trigger navigation to Export Center via custom event
    window.dispatchEvent(new CustomEvent('nav:export'));
  };
}

// Register SW
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('[Notification] SW registration failed:', err);
    return null;
  }
}
```

**Integración con JobQueue:**
```typescript
// En useJobs o en App.tsx — suscribirse al evento "all jobs done"
useEffect(() => {
  if (queueState.jobs.length > 0 && completed === queueState.jobs.length) {
    showVideoReadyNotification();
  }
}, [completed, queueState.jobs.length]);
```

**Tests obligatorios:**
```typescript
// src/__tests__/notification.test.ts
- requestNotificationPermission llama Notification.requestPermission si status='default'
- showVideoReadyNotification no hace nada si permission !== 'granted'
- registerServiceWorker retorna null si navigator no soporta SW
```

---

## 🔧 INTEGRACIÓN CON CÓDIGO EXISTENTE S1

### Cambios Mínimos en S1

| Archivo S1 | Cambio Requerido |
|------------|------------------|
| `src/stores/projectStore.ts` | Agregar método `setJobQueue(jobs: BackgroundJob[])` para integración con JobQueue |
| `src/components/export/ExportCenter.tsx` | Botón "Generar Lote (6 clips)" → abre CostEstimatorModal (antes del botón actual) |
| `src/stores/apiKeysStore.ts` | Validar que hay key configurada antes de abrir CostEstimator (por si quedó residual) |
| `src/services/gemini/video.ts` | Añadir `generateTransitionWithRetry` y `classifyVeoError` |
| `src/workers/ffmpeg.worker.ts` | Añadir handler `STATIC_FROM_IMAGE` (ya existe en S1 según reporte, validar) |

### Nuevos Sliders en `KeyframeChain` y Manifest

En `manifest.json` exportado, añadir:
```json
{
  "generation": {
    "totalEstimatedCost": 2.54,
    "totalActualCost": 2.73,
    "attempts": [...],
    "fallbacksUsed": ["trans_deseo"],
    "duration": { "estimated": 540, "actual": 612 }
  }
}
```

---

## 🧪 PLAN DE TESTING INTEGRAL

### Unit Tests (Vitest, ≥80% coverage en nuevos archivos)

| Archivo | Tests Mínimos |
|---------|--------------|
| `costEstimator.test.ts` | 4 (cost, format, ETA, disclaimers) |
| `jobQueue.test.ts` | 5 (create, process, pause, cancel, hydrate) |
| `geminiVideo.test.ts` | 4 (classify, retry, safety, attempt callback) |
| `fallbackStrategy.test.ts` | 3 (static, plain, isRecoverable) |
| `notification.test.ts` | 3 (permission, show, register) |

### Integration Tests (Playwright, E2E)

| Test | Pasos | Resultado Esperado |
|------|-------|--------------------|
| `happy-path-batch.spec.ts` | Upload 4 fotos → analizar → generar KF OUT → cost estimator → generar lote → esperar | 6 clips generados en master, notification mostrada |
| `fallback.spec.ts` | Mock Veo fallando con safety 5 veces → verificar fallback activado | UI muestra amber border, log muestra "Fallback activado: motivo=safety" |
| `survive-refresh.spec.ts` | Iniciar lote → cerrar página → reabrir → verificar jobs en cola | Jobs se reanudan, contador continúa |
| `cost-estimator.spec.ts` | Click "Generar Lote" → modal abre → confirma | Pricing total realista por 6 clips |

### Manual Acceptance Checklist (15 items)

Verificar después de implementación:

- [ ] Click "Generar Lote" abre CostEstimatorModal con desglose correcto
- [ ] Modal muestra ETA realista (~8-12 min para 6 clips)
- [ ] Click "Confirmar y Generar" cierra modal y abre JobsPanel
- [ ] JobsPanel muestra 6 jobs con estado inicial "queued"
- [ ] 3 jobs pasan a "active" en paralelo (parallelSlots=3)
- [ ] Por-job attempts incrementan en reintentos
- [ ] ETA se actualiza en tiempo real (cada 5s)
- [ ] **Cerrar pestaña y reabrir** → JobsPanel hidrata jobs pendientes
- [ ] Job con `safety` error → FallbackStrategy activado → amber border en fila
- [ ] Job con `quota` 429 → retry 3x con backoff antes de fallar definitivamente
- [ ] Todos los jobs completados → notification nativa aparece
- [ ] Click notification → tab se enfoca, navega a Export Center
- [ ] Manifest.json incluye generation.totalActualCost calculado
- [ ] Recarga F5 con jobs en cola → jobs persisten (no se duplican)
- [ ] Logs estructurados: cada retry, fallback, completion con timestamp

---

## 📡 INTEGRACIÓN CON CLOUDFLARE WORKER (Mejoras menores)

El Worker ya implementado en S1 sigue funcional, pero se sugieren estas mejoras para S2 (opcional pero recomendado):

```toml
# worker/wrangler.toml — añadir KV namespace para rate limit persistente
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "..."
```

```typescript
// worker/src/index.ts — usar KV en lugar de in-memory
async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  const key = `rl:${ip}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) ?? '0', 10);
  const limit = parseInt(env.RATE_LIMIT_RPM ?? '10', 10);
  if (current >= limit) return false;
  await env.RATE_LIMIT_KV.put(key, (current + 1).toString(), { expirationTtl: 60 });
  return true;
}
```

Esto se hace en S2 como mejora, no es bloqueante.

---

## 🚀 HANDOFF A SOFIA

**Archivo:** `context/interconsultas/S2-handoff.md`

```markdown
# Handoff S2 — SOFIA Implementation

## Contexto
Implementar Sprint 2 según SPEC-S2-ROBUSTNESS.md. S1 está cerrado y validado (4/4 logs verdes).
Dependencias S1 funcionales:
- geminiClient con backoff 1s/2s/4s (ampliar a 5 niveles)
- ffmpeg.worker con STATIC_FROM_IMAGE (ya implementado)
- projectStore persistiendo todo
- apiKeysStore con checkProxy
- promptBuilder con NO_INVENTE_RULE literal

## Tareas (Orden Recomendado)
1. **types/jobs.ts** — Ampliar con BackgroundJob, JobQueueState, JobSpec
2. **services/costEstimator.ts** — Pricing hardcoded + ETA + disclaimers
3. **services/gemini/video.ts** — generarTransitionWithRetry + classifyVeoError
4. **services/fallbackStrategy.ts** — Jerarquía de fallbacks
5. **services/jobQueue.ts** — BackgroundJobQueue con IDB + 3 slots paralelos
6. **workers/job.worker.ts** — Worker dedicado a procesar jobs
7. **services/notification.ts** — Notification API + SW register
8. **public/sw.js** — Service Worker para notification handling
9. **components/generation/CostEstimatorModal.tsx** — UI modal de costos
10. **components/generation/JobsPanel.tsx + JobRow** — UI con per-job status
11. **hooks/useJobs.ts** — Suscripción reactiva al store
12. Integración: ExportCenter.tsx → CostEstimator → JobQueue
13. Tests unitarios: 5 archivos nuevos + extensión de existentes
14. E2E Playwright: 4 specs (happy-path, fallback, survive-refresh, cost-estimator)

## Validaciones Obligatorias Antes de Cerrar
1. pnpm typecheck — 0 errores TS
2. pnpm test --run — todos los tests pasan (20/20 S1 + nuevos S2)
3. pnpm lint — 0 warnings
4. pnpm build — dist + ffmpeg-core copiados
5. Manual Acceptance 15 items — todos ✅
6. Playwright E2E — 4 specs pasan

## Self-Review Manual (sin qodo, está sunset)
1. ¿El código refleja la SPEC?
2. ¿Code smells evidentes?
3. ¿Tests cubren edge cases listados (retry 429, safety, refresh persist)?
4. ¿Riesgo de regresión en workers (jobQueue, job.worker, ffmpeg.worker)?

## Post-S2
INTEGRA invoca GEMINI para auditoría + commit con OK humano.
```

---

## 📌 NOTAS PARA SOFIA

1. **No romper S1**: Toda tarea debe ser aditiva o modificar mínimamente archivos S1.
2. **Tests obligatorios**: Cada servicio nuevo debe tener test. Sin tests = no se cuenta como completado.
3. **Worker lifecycle**: `JobQueueService.executeJob` debe limpiar worker siempre (try/finally con `worker.terminate()`).
4. **IndexedDB schema**: Si añades store nuevo, usar version migration (`upgrade` callback) para no invalidar S1.
5. **Notification permission**: Pedir permiso ANTES del primer job, no durante (UX suave). Mostrar banner discreto en Header.
6. **ETA honesto**: Si solo 1 job completado con latency 5min, ETA de los 5 restantes = 5 min × 5 / 3 slots = 8.3 min. Mostrar margen "±2 min".
7. **Fallback transparency**: amber border + icon + tooltip "Fallback activado: motivo=X. Regenera manualmente cuando la cuota vuelva." es crítico para honestidad.
8. **Service Worker**: Solo registra en producción (`import.meta.env.PROD`), en dev usar notification directa sin SW.

---

**Fin de SPEC-S2-ROBUSTNESS.md**  
*Listo para delegación a SOFIA*
