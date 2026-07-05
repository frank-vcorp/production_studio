/**
 * video — Veo 3.1 I2V generation + polling + retry robusto.
 * Spec: SPEC-S1-FOUNDATION §1.13 + ARCH-20260703-04 §5 Paso 5 + SPEC-S2-ROBUSTNESS §Tarea 2.3
 *      + ARCH-20260704-11 (predictLongRunning + instances[] body + descarga URI).
 */

import { geminiClient, GeminiProxyError } from './client';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';
import type { VideoOperation } from '@/types/gemini';
import type { VeoError, VeoErrorCode } from '@/types/jobs';

interface GenerateOpts {
  transition: KeyframeTransition;
  fromKeyframe: Keyframe;
  toKeyframe: Keyframe;
}

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 5 * 60_000; // 5 min hard cap

/**
 * Lanza una transición I2V a Veo 3.1 y devuelve la operación para polling.
 * Body shape: `{instances: [{prompt, image}], parameters: {durationSeconds, aspectRatio, personGeneration}}`.
 * Spec: ARCH-20260704-11.
 */
export async function startVideoGeneration(opts: GenerateOpts): Promise<VideoOperation> {
  const { transition, fromKeyframe } = opts;
  if (transition.status !== 'approved') {
    throw new GeminiProxyError(
      412,
      'La transición requiere prompt aprobado (status !== "approved")',
      { status: transition.status },
    );
  }
  if (!fromKeyframe.base64) {
    throw new GeminiProxyError(400, 'Keyframe origen sin base64', { id: fromKeyframe.id });
  }
  const prompt = transition.promptFinal ?? transition.prompt;
  if (!prompt) {
    throw new GeminiProxyError(400, 'Transición sin prompt', { id: transition.id });
  }

  const op = await geminiClient.generateVideo({
    instances: [
      {
        prompt,
        image: {
          data: fromKeyframe.base64,
          mimeType: fromKeyframe.mimeType ?? 'image/png',
        },
      },
    ],
    parameters: {
      durationSeconds: Math.max(3, Math.min(8, transition.duration)),
      aspectRatio: '9:16',
      personGeneration: 'dont_allow',
    },
  });
  return op;
}

/** Wrapper polling con backoff lineal */
export async function pollVideoOperation(name: string): Promise<VideoOperation> {
  const started = Date.now();
  let lastOp: VideoOperation | undefined;
  let delay = POLL_INTERVAL_MS;
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    lastOp = await geminiClient.pollOperation(name);
    if (lastOp.done) return lastOp;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 2000, POLL_INTERVAL_MS + 8000); // gradual ramp
  }
  throw new GeminiProxyError(504, 'Tiempo de espera agotado mientras Veo generaba el clip', { name, last: lastOp });
}

/**
 * Descarga el video MP4 desde la URI firmada y devuelve Blob + Object URL.
 * Versión ASYNC (antes era sync) porque Veo 3.1 ya NO devuelve inlineData.
 * Spec: ARCH-20260704-11.
 */
export async function extractVideoFromOperation(op: VideoOperation): Promise<{ blob: Blob; url: string }> {
  if (!op.done) {
    throw new GeminiProxyError(409, 'La operación de Veo aún no ha terminado', {});
  }
  const videos = op.response?.generateVideoResponse?.videos ?? [];
  const v = videos[0];
  if (!v) {
    throw new GeminiProxyError(
      500,
      'Veo no devolvió ningún video en la respuesta (response.generateVideoResponse.videos vacío)',
      { op },
    );
  }
  if (!v.uri) {
    throw new GeminiProxyError(500, 'Veo devolvió el video sin URI firmada', { video: v });
  }
  const blob = await geminiClient.downloadVideo(v.uri);
  return { blob, url: URL.createObjectURL(blob) };
}

/** Flujo completo: start + poll + blob */
export async function generateTransition(opts: GenerateOpts): Promise<{ blob: Blob; url: string; operationId: string }> {
  const op = await startVideoGeneration(opts);
  const opName = op.name;
  const completed = await pollVideoOperation(opName);
  const { blob, url } = await extractVideoFromOperation(completed);
  return { blob, url, operationId: opName };
}

/** Stub de polling expuesto para tests (evita fetch real) */
export const __pollIntervalMs = POLL_INTERVAL_MS;
export const __pollTimeoutMs = POLL_TIMEOUT_MS;

// ────────────────────────────────────────────────────────────────────────
// S2 — Retry robusto + error classification
// ────────────────────────────────────────────────────────────────────────

/** Backoff exponencial: 5 intentos (1s, 2s, 4s, 8s, 16s). */
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000] as const;

/** Mapea un error crudo a un VeoError tipado. */
export function classifyVeoError(err: unknown): VeoError {
  const e = err as { status?: number; message?: string; code?: string; details?: unknown };
  const status = typeof e?.status === 'number' ? e.status : 0;
  const message = String(e?.message ?? err ?? 'Unknown error');
  const lower = message.toLowerCase();

  let code: VeoErrorCode = 'unknown';
  let retryable = false;

  if (status === 429 || lower.includes('quota') || lower.includes('rate')) {
    code = 'quota';
    retryable = true;
  } else if (status === 408 || lower.includes('timeout')) {
    code = 'timeout';
    retryable = true;
  } else if (status >= 500 || lower.includes('network') || lower.includes('upstream')) {
    code = 'network';
    retryable = true;
  } else if (status === 400 && (lower.includes('safety') || lower.includes('blocked') || lower.includes('policy'))) {
    code = 'safety';
    retryable = false;
  } else {
    code = 'unknown';
    retryable = false;
  }

  const veoErr: VeoError = Object.assign(new Error(message), {
    code,
    retryable,
    details: e?.details,
  });
  return veoErr;
}

export interface RetryResult {
  blob: Blob;
  url: string;
  operationId: string;
  attempts: number;
  totalLatencyMs: number;
}

/**
 * Versión con retry: 5 intentos con backoff exponencial.
 * - Verifica approval gate (ADR-04) en CADA intento.
 * - Falla rápido (throw) si el error es no-retryable (ej. safety).
 */
export async function generateTransitionWithRetry(
  transition: KeyframeTransition,
  keyframeFrom: Keyframe,
  keyframeTo: Keyframe,
  onAttempt?: (attempt: number, totalLatencyMs: number) => void,
): Promise<RetryResult> {
  const start = performance.now();
  let lastError: VeoError | null = null;

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      // Invariante ADR-04: nunca bypass del approval gate.
      if (transition.status !== 'approved') {
        throw new GeminiProxyError(
          412,
          `La transición no está aprobada (estado: ${transition.status})`,
          { status: transition.status },
        );
      }
      onAttempt?.(attempt, performance.now() - start);

      const result = await generateTransition({ transition, fromKeyframe: keyframeFrom, toKeyframe: keyframeTo });
      return {
        blob: result.blob,
        url: result.url,
        operationId: result.operationId,
        attempts: attempt,
        totalLatencyMs: performance.now() - start,
      };
    } catch (err) {
      const veoErr = err instanceof GeminiProxyError ? classifyVeoError(err) : classifyVeoError(err);
      veoErr.attemptNumber = attempt;
      lastError = veoErr;
      console.warn(`[VeoClient] Intento ${attempt} falló:`, veoErr.code, veoErr.message);

      if (!veoErr.retryable) {
        // Safety u otro no-retryable → throw inmediato (no intentemos de nuevo).
        throw veoErr;
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt - 1];
        console.log(`[VeoClient] Reintentando en ${delay}ms...`);
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error('Se agotaron todos los reintentos');
}
