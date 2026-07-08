/**
 * mockVision — Simulación determinista de Gemini Vision.
 * Spec: ARCH-20260705-04 + SPEC-20260705-04 §2.1
 *
 * Devuelve un `VisualAnalysis` plausible sin llamar a Gemini.
 * El campo `subject` incluye un hash estable derivado del blob de entrada
 * para que el mismo input produzca el mismo output (idempotencia).
 */
import type { VisualAnalysis } from '@/types/keyframe';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Hash determinista NO-criptográfico basado en tamaño + mime + primeros 100 bytes.
 * Suficiente para identificar blobs sin necesidad de Web Crypto (no determinista
 * con SHA-256 en jsdom sin subtytle).
 */
async function blobHash(blob: Blob): Promise<string> {
  try {
    const slice = blob.slice(0, 100);
    const buf = await slice.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let h = `${blob.size}:${blob.type || 'unknown'}:`;
    for (let i = 0; i < bytes.length; i++) {
      h += bytes[i].toString(16).padStart(2, '0');
    }
    return h.slice(0, 32);
  } catch {
    // Fallback extremo: derivar hash solo de metadatos del blob.
    return `${blob.size}:${blob.type || 'unknown'}:empty`;
  }
}

/** Latencia simulada: 1.5-2.5s (consistente con UX esperada de Vision). */
export async function mockAnalyzeImageForVision(blob: Blob): Promise<VisualAnalysis> {
  await sleep(1500 + Math.random() * 1000);

  const hash = await blobHash(blob);

  return {
    subject: `[SANDBOX] Sujeto simulado (h:${hash.slice(0, 8)})`,
    environment: 'Entorno simulado por sandbox local (sin API)',
    lighting: 'Iluminación neutra de prueba',
    composition: 'Composición centrada simulada',
    colorPalette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
    textures: ['textura simulada A', 'textura simulada B'],
    cameraPosition: 'frontal a nivel de ojos (sandbox)',
    depthOfField: 'medium',
    dominantShapes: ['rectángulo', 'círculo'],
    technicalNotes: 'Análisis generado localmente por sandbox. NO es output de Gemini.',
    analyzedAt: Date.now(),
    model: 'sandbox-vision-v1',
    confidence: 0.95,
  };
}