/**
 * video — Veo 3.1 I2V generation + polling + retry robusto.
 * Spec: SPEC-S1-FOUNDATION §1.13 + ARCH-20260703-04 §5 Paso 5 + SPEC-S2-ROBUSTNESS §Tarea 2.3
 *      + ARCH-20260704-11 (predictLongRunning + instances[] body + descarga URI)
 *      + ARCH-20260705-04 (sandbox toggle + RETRY_DELAYS_MS 2).
 */

import { geminiClient, GeminiProxyError } from './client';
import { IS_SANDBOX } from '@/utils/sandbox';
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
 * Body shape: `{instances: [{prompt, image}], parameters: {durationSeconds, aspectRatio}}`.
 * Spec: ARCH-20260704-11 + ARCH-20260705-02 (bytesBase64Encoded, sin personGeneration).
 */
export async function startVideoGeneration(opts: GenerateOpts): Promise<VideoOperation> {
  // ARCH-20260705-04: ruta sandbox determinista (sin red, sin créditos).
  if (IS_SANDBOX) {
    const { mockStartVideoGeneration } = await import('@/services/sandbox');
    return mockStartVideoGeneration(opts);
  }
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

  // ARCH-20260705-02:
  // - image.data → image.bytesBase64Encoded (campo soportado por Gemini Developer API).
  // - personGeneration omitido: 'dont_allow' no soportado en Veo 3.1 público
  //   (verificado con smoke test 2026-07-05).
  const op = await geminiClient.generateVideo({
    instances: [
      {
        prompt,
        image: {
          bytesBase64Encoded: fromKeyframe.base64,
          mimeType: fromKeyframe.mimeType ?? 'image/png',
        },
      },
    ],
    parameters: {
      durationSeconds: Math.max(3, Math.min(8, transition.duration)),
      aspectRatio: '9:16',
    },
  });
  return op;
}

/** Wrapper polling con backoff lineal */
export async function pollVideoOperation(name: string): Promise<VideoOperation> {
  // ARCH-20260705-04: ruta sandbox determinista.
  if (IS_SANDBOX) {
    const { mockPollVideoOperation } = await import('@/services/sandbox');
    return mockPollVideoOperation(name);
  }
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
export async function extractVideoFromOperation(
  op: VideoOperation,
  fromKeyframe?: Keyframe,
  transition?: KeyframeTransition,
): Promise<{ blob: Blob; url: string }> {
  // ARCH-20260705-04: ruta sandbox — necesita keyframe origen + transición para
  // generar el blob simulado (no hay URI firmada real).
  if (IS_SANDBOX) {
    if (!fromKeyframe || !transition) {
      throw new GeminiProxyError(
        500,
        'Sandbox requiere fromKeyframe + transition para generar el clip simulado',
        {},
      );
    }
    const { mockExtractVideoFromOperation } = await import('@/services/sandbox');
    const { blob, url } = await mockExtractVideoFromOperation(op, fromKeyframe, transition);
    return { blob, url };
  }
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
  // ARCH-20260705-04: pasamos keyframeFrom + transition para que la ruta
  // sandbox pueda generar el blob simulado. En producción se ignoran.
  const { blob, url } = await extractVideoFromOperation(completed, opts.fromKeyframe, opts.transition);
  return { blob, url, operationId: opName };
}

/** Stub de polling expuesto para tests (evita fetch real) */
export const __pollIntervalMs = POLL_INTERVAL_MS;
export const __pollTimeoutMs = POLL_TIMEOUT_MS;

// ────────────────────────────────────────────────────────────────────────
// S2 — Retry robusto + error classification
// ────────────────────────────────────────────────────────────────────────

/**
 * ARCH-20260705-04 (defensa en profundidad): 2 intentos (1s, 4s) en lugar de 5.
 * Reduce el costo máximo por fallo de ~$2.00 USD a ~$0.80 USD.
 * En sandbox este array NO se usa (mock determinista no reintenta).
 */
export const RETRY_DELAYS_MS = [1000, 4000] as const;

/** Mapea un error crudo a un VeoError tipado. */
export function classifyVeoError(err: unknown): VeoError {
  const e = err as {
    status?: number;
    message?: string;
    code?: string;
    details?: unknown;
    body?: unknown;
  };
  const status = typeof e?.status === 'number' ? e.status : 0;

  // Extraer mensaje legible de fuentes posibles en orden de prioridad.
  // ARCH-20260705-02: cuando el Worker responde 400 con body JSON
  // `{error: {message: "..."}}`, el mensaje real vive en e.body.error.message
  // (o e.details.error.message si el cliente lo guardó ahí). Sin esta lógica
  // el fallback String(err) produce "[object Object]" en el toast.
  let message = '';
  if (
    typeof e?.message === 'string' &&
    e.message &&
    e.message !== '[object Object]'
  ) {
    message = e.message;
  } else if (e?.body && typeof e.body === 'object') {
    const b = e.body as { error?: { message?: string } | string; message?: string };
    const errField = b.error;
    message =
      (typeof errField === 'object' && errField && 'message' in errField
        ? (errField as { message?: string }).message
        : typeof errField === 'string'
          ? errField
          : '') ?? b.message ?? '';
  } else if (typeof e?.body === 'string') {
    message = e.body;
  } else if (e?.details && typeof e.details === 'object') {
    const d = e.details as { error?: { message?: string } | string; message?: string };
    const errField = d.error;
    message =
      (typeof errField === 'object' && errField && 'message' in errField
        ? (errField as { message?: string }).message
        : typeof errField === 'string'
          ? errField
          : '') ?? d.message ?? '';
  } else if (typeof err === 'string') {
    message = err;
  }

  if (!message) {
    try {
      message = JSON.stringify(err).slice(0, 500);
    } catch {
      message = 'Error desconocido al comunicarse con Veo';
    }
  }
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
    details: e?.details ?? e?.body,
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
