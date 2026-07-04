/**
 * video — Veo 3.1 I2V generation + polling.
 * Spec: SPEC-S1-FOUNDATION §1.13 + ARCH-20260703-04 §5 Paso 5.
 */

import { geminiClient, GeminiProxyError } from './client';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';
import type { VideoOperation } from '@/types/gemini';

interface GenerateOpts {
  transition: KeyframeTransition;
  fromKeyframe: Keyframe;
  toKeyframe: Keyframe;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 5 * 60_000; // 5 min hard cap

/** Lanza una transición I2V y devuelve la operación para polling */
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
    input_image: fromKeyframe.base64,
    input_image_mimeType: fromKeyframe.mimeType ?? 'image/png',
    prompt,
    durationSeconds: Math.max(3, Math.min(8, transition.duration)),
    fps: 24,
    aspectRatio: '9:16',
    model: 'veo-3.1',
    personGeneration: 'dont_allow',
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
  throw new GeminiProxyError(504, 'Veo polling timeout', { name, last: lastOp });
}

/** Descarga el video resultado y devuelve Blob + URL */
export function extractVideoFromOperation(op: VideoOperation): { blob: Blob; url: string } {
  if (!op.done) {
    throw new GeminiProxyError(409, 'Operation not done yet', {});
  }
  type InlinePair = { uri?: string; inlineData?: { mimeType: string; data: string } };
  const videos: InlinePair[] =
    op.response?.videos ??
    ((op.response?.generatedVideos ?? [])
      .map((g): InlinePair | null => (g.video?.uri ? { uri: g.video.uri, inlineData: g.video.inlineData } : null))
      .filter((v): v is InlinePair => v !== null)) ??
    [];
  const v = videos[0];
  if (!v) throw new GeminiProxyError(500, 'Veo response without videos', { op });

  if (v.inlineData) {
    const blob = base64ToBlob(v.inlineData.data, v.inlineData.mimeType ?? 'video/mp4');
    return { blob, url: URL.createObjectURL(blob) };
  }
  if (v.uri) {
    // Descarga por URL (asume accesible server-side, no público)
    // En S1 + proxy: la URL no es pública; pedimos al proxy que la descargue.
    // Política: si no inline, rechazamos para que el cliente sepa que el proxy debe
    // entregar el binario por una ruta /api/gemini/downloadVideo.
    throw new GeminiProxyError(501, 'URL-only videos not supported in S1; require inline data', { uri: v.uri });
  }
  throw new GeminiProxyError(500, 'Video has neither inline nor uri', {});
}

/** Flujo completo: start + poll + blob */
export async function generateTransition(opts: GenerateOpts): Promise<{ blob: Blob; url: string; operationId: string }> {
  const op = await startVideoGeneration(opts);
  const opName = op.name;
  const completed = await pollVideoOperation(opName);
  const { blob, url } = extractVideoFromOperation(completed);
  return { blob, url, operationId: opName };
}

/** Stub de polling expuesto para tests (evita fetch real) */
export const __pollIntervalMs = POLL_INTERVAL_MS;
export const __pollTimeoutMs = POLL_TIMEOUT_MS;
