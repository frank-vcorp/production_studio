/**
 * mockVideo — Simulación determinista de Veo 3.1.
 * Spec: ARCH-20260705-04 + SPEC-20260705-04 §2.2
 *
 * Devuelve imágenes PNG con overlay "SANDBOX VIDEO" como sustituto del clip MP4.
 * WebCodecs para MP4 real requeriría Chromium + permisos adicionales;
 * la SPEC recomienda esta opción más simple (overlay PNG).
 */
import type { VideoOperation } from '@/types/gemini';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Genera un PNG simulado con overlay SANDBOX a partir del keyframe origen. */
async function generateDummyVideoBlob(
  fromImage: Blob | undefined,
  prompt: string,
): Promise<Blob> {
  // ARCH-20260705-04: jsdom y entornos sin canvas 2D caen a PNG mínimo válido.
  // En el browser se renderiza el overlay visual; en tests basta con shape.
  try {
    let width = 512;
    let height = 512;
    let bitmap: ImageBitmap | null = null;
    if (fromImage) {
      try {
        bitmap = await createImageBitmap(fromImage);
        width = bitmap.width || width;
        height = bitmap.height || height;
      } catch {
        bitmap = null;
      }
    }
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');

    // Fondo: degradado oscuro distintivo del sandbox
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Si tenemos bitmap, dibujarlo encima como "frame"
    if (bitmap) {
      ctx.drawImage(bitmap, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, width, height);
    }

    // Overlay sandbox (parte superior)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, width, 90);
    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold ${Math.round(width / 24)}px sans-serif`;
    ctx.fillText('🧪 SANDBOX VIDEO', 20, 35);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `${Math.round(width / 48)}px monospace`;
    ctx.fillText(prompt.slice(0, Math.round(width / 8)), 20, 60);
    ctx.fillText('No es un clip real. Toggle VITE_USE_SANDBOX=false para producción.', 20, 78);

    // Sello diagonal de "SIMULATED"
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.font = `bold ${Math.round(width / 8)}px sans-serif`;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.textAlign = 'center';
    ctx.fillText('SIMULATED', 0, 0);
    ctx.restore();

    return await canvas.convertToBlob({ type: 'image/png' });
  } catch {
    // Fallback: PNG header mínimo + pixel transparente.
    return new Blob(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])],
      { type: 'image/png' },
    );
  }
}

export interface MockVideoOpts {
  transition: KeyframeTransition;
  fromKeyframe: Keyframe;
  toKeyframe: Keyframe;
}

/** Inicia una "operación" de generación en sandbox (latencia simulada 0.8-1.2s). */
export async function mockStartVideoGeneration(_opts: MockVideoOpts): Promise<VideoOperation> {
  await sleep(800 + Math.random() * 400);
  return {
    name: `sandbox-ops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    done: false,
    metadata: { progressPercent: 0 },
  };
}

/** Polling: siempre devuelve done=true tras latencia simulada (no-op async). */
export async function mockPollVideoOperation(name: string): Promise<VideoOperation> {
  // Mantener la simulación de "espera" corta para que la UI sienta el progreso.
  await sleep(500 + Math.random() * 500);
  return {
    name,
    done: true,
    response: {
      // En sandbox no necesitamos populate real; mockExtractVideoFromOperation
      // genera el blob desde el keyframe origen, no desde la operation.
      generateVideoResponse: { videos: [{ uri: 'sandbox://no-uri' }] },
    },
  };
}

/** Extrae el blob simulado a partir del keyframe origen + transición. */
export async function mockExtractVideoFromOperation(
  _op: VideoOperation,
  fromKeyframe: Keyframe,
  transition: KeyframeTransition,
): Promise<{ blob: Blob; url: string; operationId: string }> {
  const prompt = transition.promptFinal ?? transition.prompt ?? 'sin prompt';
  const blob = await generateDummyVideoBlob(fromKeyframe.blob, prompt);
  const url = URL.createObjectURL(blob);
  return { blob, url, operationId: _op.name ?? 'sandbox' };
}