/**
 * keyframeGenerator — Imagen 3 para keyframes OUT faltantes.
 * Spec: SPEC-S1-FOUNDATION §1.8 + ARCH-20260703-04 §3 Paso 3
 *      + ARCH-20260705-04 (sandbox toggle).
 */

import { geminiClient, GeminiProxyError } from './client';
import { IS_SANDBOX } from '@/utils/sandbox';
import { buildImage3Prompt } from '@/services/promptBuilder';
import type { Keyframe, VisualAnalysis, CameraSpec } from '@/types/keyframe';
import type { MasterBrief } from '@/types/brief';
import type { BrandKit } from '@/types/project';

/** Convierte Blob a base64 (no-strip) */
async function blobToBase64Raw(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') return reject(new Error('FileReader error'));
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/** Convierte base64 a Blob */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Genera UN keyframe OUT desde KF_IN + intención */
export async function generateKeyframeOut(
  keyframeIn: Keyframe,
  intent: string,
  cameraSpec: CameraSpec,
  brief: MasterBrief,
  brandKit: BrandKit | null,
): Promise<{
  blob: Blob;
  base64: string;
  mimeType: string;
  prompt: string;
}> {
  if (!keyframeIn.base64) {
    throw new Error(`Keyframe ${keyframeIn.id} no tiene imagen base64`);
  }
  const visualAnalysis = keyframeIn.visualAnalysis;
  const prompt = buildImage3Prompt({
    kfIn: keyframeIn,
    intent,
    cameraSpec,
    visualAnalysis,
    brief,
    brandKit,
  });

  let blob: Blob;
  let mimeType: string;
  // ARCH-20260705-04: ruta sandbox determinista.
  if (IS_SANDBOX) {
    const { mockGenerateImage } = await import('@/services/sandbox');
    const sandboxRes = await mockGenerateImage(prompt);
    blob = sandboxRes.blob;
    mimeType = sandboxRes.mimeType;
  } else {
    const res = await geminiClient.generateImage({
      prompt,
      referenceImage: { mimeType: keyframeIn.mimeType ?? 'image/png', data: keyframeIn.base64 },
      aspectRatio: '9:16',
      numberOfImages: 1,
      personGeneration: 'dont_allow',
      safetyFilterLevel: 'block_medium_and_above',
    });
    const pred = res.predictions?.[0];
    if (!pred) throw new GeminiProxyError(500, 'Imagen 3 sin predictions', { prompt });
    mimeType = pred.mimeType ?? 'image/png';
    blob = base64ToBlob(pred.bytesBase64Encoded, mimeType);
  }
  const base64 = await blobToBase64Raw(blob);
  return { blob, base64, mimeType, prompt };
}

/** Genera TODOS los keyframes OUT faltantes (atencion_out, interes_out, deseo_out) */
export async function generateMissingKeyframes(
  keyframes: Map<string, Keyframe>,
  brief: MasterBrief,
  brandKit: BrandKit | null,
): Promise<Map<string, Partial<Keyframe>>> {
  const targets: Array<{ inId: string; outId: string; node: 'atencion' | 'interes' | 'deseo' }> = [
    { inId: 'kf_atencion_in', outId: 'kf_atencion_out', node: 'atencion' },
    { inId: 'kf_interes_in', outId: 'kf_interes_out', node: 'interes' },
    { inId: 'kf_deseo_in', outId: 'kf_deseo_out', node: 'deseo' },
  ];
  const results = new Map<string, Partial<Keyframe>>();

  for (const t of targets) {
    const kfIn = keyframes.get(t.inId);
    if (!kfIn || !kfIn.base64) continue;
    const intent = kfIn.humanIntent ?? `transición natural del problema al taller de ${brief.business.name}`;
    const camera: CameraSpec = kfIn.cameraSpec ?? {
      movement: 'slow reveal',
      framing: 'medium',
      angle: 'eye level',
      speed: 'medium',
    };
    const out = await generateKeyframeOut(kfIn, intent, camera, brief, brandKit);
    // Análisis del resultado (best-effort)
    let va: VisualAnalysis | undefined;
    try {
      const { analyzeImageForVision } = await import('./imageAnalysis');
      va = await analyzeImageForVision(out.blob);
    } catch {
      va = undefined;
    }
    results.set(t.outId, {
      blob: out.blob,
      base64: out.base64,
      mimeType: out.mimeType,
      source: 'generated_imagen3',
      status: va ? 'generated' : 'uploaded',
      generationPrompt: out.prompt,
      visualAnalysis: va,
    });
  }
  return results;
}
