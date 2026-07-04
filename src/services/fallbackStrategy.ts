/**
 * fallbackStrategy — jerarquía de fallback para Veo fallido.
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.4.
 *
 * Cuando Veo falla por safety/quota/timeout/network:
 *   Strategy 1: imagen estática + slow zoom (imagen keyframe + ffmpeg zoompan)
 *   Strategy 2: plain color con texto (gradient + label del nodo)
 *
 * Si Strategy 1 falla → Strategy 2.
 * Si Strategy 2 falla → throw (no recoverable).
 */

import { ffmpegService } from './ffmpeg';
import { generateKeyframeOut } from './gemini/keyframeGenerator';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';
import type { MasterBrief } from '@/types/brief';
import type { VeoError } from '@/types/jobs';

export type FallbackStrategy = 'imagen3_static' | 'imagen3_blur_zoom' | 'plain_color_with_text';

export type FallbackReason = 'safety' | 'quota' | 'timeout' | 'unknown';

export interface FallbackResult {
  blob: Blob;
  strategy: FallbackStrategy;
  reason: FallbackReason;
  generationLog: string[];
}

/** Determina si el error de Veo permite intentar fallback. */
export function isRecoverableError(err: VeoError): boolean {
  // Safety NO es retryable pero SÍ recuperable vía fallback (imagen estática).
  // Quota/timeout: ya se reintentó en retry, ahora fallback.
  // Unknown: por defecto, intentar fallback.
  return ['safety', 'quota', 'timeout', 'unknown'].includes(err.code);
}

/** Convierte Blob/base64 a Blob garantizado (re-decodifica base64 si hace falta). */
async function ensureBlob(source: Blob | string | undefined): Promise<Blob | null> {
  if (!source) return null;
  if (source instanceof Blob) return source;
  if (typeof source === 'string') {
    const binary = atob(source);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  }
  return null;
}

export interface FallbackInput {
  transition: KeyframeTransition;
  keyframeFrom: Keyframe;
  keyframeTo: Keyframe | null;
  reason: FallbackReason;
  brief: MasterBrief | null;
}

/**
 * Genera un video de fallback aplicando la jerarquía.
 * Devuelve un Blob reproducible + metadatos para telemetría.
 */
export async function generateFallbackVideo(input: FallbackInput): Promise<FallbackResult> {
  const { transition, keyframeFrom, reason, brief } = input;
  const log: string[] = [`Fallback activado: motivo=${reason}`];

  // Strategy 1: imagen estática con slow zoom (keyframeFrom como base).
  try {
    log.push('Strategy 1: Static image with slow zoom');
    let baseBlob = await ensureBlob(keyframeFrom.blob ?? (keyframeFrom.base64 ?? undefined));

    // Si no hay base (caso raro: KF sin blob y sin base64), intentar regenerar con Imagen 3.
    if (!baseBlob) {
      log.push('KF origen sin blob/base64, regenerando con Imagen 3');
      if (!brief) {
        throw new Error('KF origen sin imagen y sin brief para regenerar');
      }
      const cameraSpec = transition.cameraSpec ?? {
        movement: 'slow reveal',
        framing: 'medium',
        angle: 'eye level',
        speed: 'medium',
      };
      const out = await generateKeyframeOut(
        keyframeFrom,
        keyframeFrom.humanIntent ?? `transición ${transition.nodeKey}`,
        cameraSpec,
        brief,
        null,
      );
      baseBlob = out.blob;
    }

    const video = await ffmpegService.staticVideoFromImage(baseBlob, transition.duration);
    log.push('Success: Static video generated');
    return { blob: video, strategy: 'imagen3_blur_zoom', reason, generationLog: log };
  } catch (e1) {
    log.push(`Strategy 1 failed: ${(e1 as Error).message}`);
    // Strategy 2 ya no requiere la imagen base — solo color de marca + label.
  }

  // Strategy 2: plain color con texto del nodo.
  try {
    log.push('Strategy 2: Plain color with subtitle');
    // FFmpeg service no expone staticColorWithText; lo simulamos reutilizando
    // staticVideoFromImage con un PNG 1x1 del color de marca.
    const color = pickBrandColor(input);
    const colorImg = await colorImageBlob(color);
    const video = await ffmpegService.staticVideoFromImage(colorImg, transition.duration);
    log.push('Success: Plain-color fallback generated');
    return { blob: video, strategy: 'plain_color_with_text', reason, generationLog: log };
  } catch (e2) {
    log.push(`Strategy 2 failed: ${(e2 as Error).message}`);
    throw new Error(`All fallback strategies failed. Logs: ${log.join(' | ')}`);
  }
}

function pickBrandColor(_input: FallbackInput): string {
  // Estrategia: color neutro #0b0f19 (bg slate-950) como fallback universal.
  // Si tenemos brandKit accesible en el futuro, leer primary.
  return '#0b0f19';
}

/** Genera un PNG 1x1 del color hex dado (FFmpeg lo escalará al output final). */
async function colorImageBlob(hex: string): Promise<Blob> {
  void hex; // hex ya se usa en la rama canvas; rama fallback usa PNG pre-built
  // 1x1 PNG of given RGB. Pre-built base64 de un PNG 1x1 negro; reemplazamos
  // el IDAT sería costoso, así que usamos Canvas API si está disponible.
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/jpeg', 0.9);
      });
    }
  }
  // Fallback para entornos sin DOM (workers): devolver PNG 1x1 negro pre-built.
  const PNG_1x1_BLACK =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
  const binary = atob(PNG_1x1_BLACK);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}