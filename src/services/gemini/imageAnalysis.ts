/**
 * imageAnalysis — Gemini Vision → VisualAnalysis JSON validado.
 * Spec: SPEC-S1-FOUNDATION §1.7 + ARCH-20260703-04 §3.
 */

import { geminiClient, GeminiProxyError } from './client';
import type { VisualAnalysis } from '@/types/keyframe';

interface RawVisualAnalysis {
  subject: unknown;
  environment: unknown;
  lighting: unknown;
  composition: unknown;
  colorPalette: unknown;
  textures: unknown;
  cameraPosition: unknown;
  depthOfField: unknown;
  dominantShapes: unknown;
  technicalNotes: unknown;
  confidence: unknown;
}

const VISION_PROMPT = `Eres un director de fotografía senior. Analiza la imagen de referencia con MÁXIMO rigor para alimentar prompts de generación de video (Veo) que deben anclarse visualmente a esta realidad.

Devuelve SOLO JSON estricto (application/json) con este shape EXACTO:

{
  "subject": "string corta (8-200 chars)",
  "environment": "string",
  "lighting": "string",
  "composition": "string",
  "colorPalette": ["#hex", "#hex", "#hex", "#hex"],
  "textures": ["...", "..."],
  "cameraPosition": "string corta",
  "depthOfField": "shallow|medium|deep",
  "dominantShapes": ["..."],
  "technicalNotes": "1-2 frases para prompts",
  "confidence": 0.0
}

REGLAS:
- Describe SOLO lo que ves. NO inventes elementos.
- "subject" = qué es lo principal (objeto, persona, escena).
- "environment" = lugar físico (sin inventar espacios no presentes).
- "lighting" = dirección, dureza, temperatura.
- "composition" = framing, regla tercios, líneas guía.
- "colorPalette" = 4-6 colores hex dominantes.
- "textures" = materiales/tactilidad visible.
- "cameraPosition" = ángulo del observador (contrapicado, cenital, frontal macro, etc).
- "depthOfField" = shallow|medium|deep.
- "dominantShapes" = formas geométricas que predominan.
- "technicalNotes" = detalles útiles para prompts.
- "confidence" = 0.0-1.0.
- Responde TODOS los valores de texto en español (subject, environment, lighting, composition, cameraPosition, technicalNotes, dominantShapes, textures).
- Los nombres de campos (keys del JSON) se mantienen en inglés, pero los valores (values) van en español.

Imagen a analizar:
`;

function asString(v: unknown, minLen = 4): string | null {
  return typeof v === 'string' && v.trim().length >= minLen ? v.trim() : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
}

function asDof(v: unknown): 'shallow' | 'medium' | 'deep' {
  return v === 'shallow' || v === 'deep' ? v : 'medium';
}

function asConfidence(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function validateAnalysis(raw: unknown): VisualAnalysis {
  if (!raw || typeof raw !== 'object') throw new GeminiProxyError(500, 'La respuesta de Vision no es un objeto válido', {});
  const r = raw as RawVisualAnalysis;
  const subject = asString(r.subject, 8);
  const environment = asString(r.environment, 8);
  const lighting = asString(r.lighting, 8);
  const composition = asString(r.composition, 8);
  const cameraPosition = asString(r.cameraPosition, 4);
  const technicalNotes = asString(r.technicalNotes, 8);
  const colorPalette = asStringArray(r.colorPalette);
  if (!subject || !environment || !lighting || !composition || !cameraPosition || !technicalNotes) {
    throw new GeminiProxyError(500, 'El esquema de Vision está incompleto', { raw });
  }
  if (colorPalette.length < 1) {
    throw new GeminiProxyError(500, 'Vision: la paleta de colores es obligatoria', { raw });
  }
  return {
    subject,
    environment,
    lighting,
    composition,
    colorPalette,
    textures: asStringArray(r.textures),
    cameraPosition,
    depthOfField: asDof(r.depthOfField),
    dominantShapes: asStringArray(r.dominantShapes),
    technicalNotes,
    analyzedAt: Date.now(),
    model: 'gemini-2.5-flash',
    confidence: asConfidence(r.confidence),
  };
}

/** Blob -> base64 inlineData para contents[].parts.inlineData */
async function blobToBase64Parts(blob: Blob): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') return reject(new Error('FileReader error'));
      const idx = result.indexOf(',');
      const data = idx >= 0 ? result.slice(idx + 1) : result;
      resolve({ mimeType: blob.type || 'image/png', data });
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export async function analyzeImageForVision(blob: Blob): Promise<VisualAnalysis> {
  const parts = await blobToBase64Parts(blob);
  const res = await geminiClient.analyzeImage({
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: parts },
          { text: VISION_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      topP: 0.8,
    },
  });

  const part = res.candidates?.[0]?.content?.parts?.find((p) => 'text' in p);
  if (!part || !('text' in part)) {
    throw new GeminiProxyError(500, 'Empty response from vision', {});
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(part.text.trim());
  } catch {
    throw new GeminiProxyError(500, 'Vision returned non-JSON', { raw: part.text });
  }
  return validateAnalysis(parsed);
}

/** Cache simple en memoria (size+mime) */
const analysisCache = new Map<string, VisualAnalysis>();

export async function analyzeImageForVeo(blob: Blob): Promise<VisualAnalysis> {
  const cacheKey = `${blob.type}:${blob.size}`;
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.analyzedAt < 1000 * 60 * 60) return cached;
  const result = await analyzeImageForVision(blob);
  analysisCache.set(cacheKey, result);
  return result;
}
