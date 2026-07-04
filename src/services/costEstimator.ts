/**
 * costEstimator — pricing hardcoded + ETA + disclaimers.
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.1.
 *
 * Tabla de precios basada en docs públicas de Gemini API (jul-2026).
 * Pricing es estimado: el costo real puede variar por duración efectiva,
 * reintentos por safety y tokens consumidos.
 */

import type { CostBreakdown, PricingTier } from '@/types/jobs';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';
import type { MasterBrief } from '@/types/brief';

export const PRICING_TABLE = {
  /** Veo 3.1 — USD por clip de 7s (I2V). */
  veo: 0.4,
  /** Imagen 3 — USD por imagen generada. */
  imagen3: 0.02,
  /** TTS — USD por segundo de audio sintetizado. */
  ttsPerSec: 0.001,
  /** LLM Gemini 2.5 Pro — USD por 1k tokens (input). */
  llmPer1kTokens: 0.00125,
  /** Latencias promedio históricas (para ETA inicial). */
  avgVeoLatencySec: 180, // 3 min
  avgImagenLatencySec: 8,
  avgTTSLatencySec: 4,
} as const;

export const PRICING_DISCLAIMER = [
  '⚠️ Los precios son estimados basados en la tabla pública de Google.',
  'El costo real puede variar según duración efectiva, reintentos por safety, y tokens consumidos.',
  'Configura tu API key en Google Cloud para ver el costo exacto.',
].join(' ');

export interface CostEstimatorInput {
  transitions: KeyframeTransition[];
  keyframesNeedGeneration: Keyframe[];
  voiceoverText: string;
  voiceoverDurationSec: number;
  brief: MasterBrief | null;
}

function tierForMonthlyUsd(_brief: MasterBrief | null): PricingTier {
  // Stub: en producción, consultar proxy /quota. Para S2, default tier1.
  return 'tier1';
}

function estimateTokens(brief: MasterBrief | null): number {
  if (!brief) return 0;
  // Heurística: brief JSON serializado ≈ 1k tokens en tier1 simple.
  // Cada servicio añade ~150 tokens.
  return 1000 + brief.services.length * 150;
}

export function estimateCost(input: CostEstimatorInput): CostBreakdown {
  const {
    transitions,
    keyframesNeedGeneration,
    voiceoverDurationSec,
    brief,
  } = input;

  const videoClipCount = transitions.length;
  const videoClips = {
    count: videoClipCount,
    unitPrice: PRICING_TABLE.veo,
    subtotal: round3(videoClipCount * PRICING_TABLE.veo),
  };

  const imageCount = keyframesNeedGeneration.length;
  const imageGeneration = {
    count: imageCount,
    unitPrice: PRICING_TABLE.imagen3,
    subtotal: round3(imageCount * PRICING_TABLE.imagen3),
  };

  const tts = {
    durationSec: Math.max(0, Math.round(voiceoverDurationSec)),
    unitPricePerSec: PRICING_TABLE.ttsPerSec,
    subtotal: round3(voiceoverDurationSec * PRICING_TABLE.ttsPerSec),
  };

  const tokens = estimateTokens(brief);
  const llm = {
    tokens,
    unitPricePer1k: PRICING_TABLE.llmPer1kTokens,
    subtotal: round3((tokens / 1000) * PRICING_TABLE.llmPer1kTokens),
  };

  const total = round3(videoClips.subtotal + imageGeneration.subtotal + tts.subtotal + llm.subtotal);
  const estimatedTotalTimeSec = estimateETA(
    {
      videoClips,
      imageGeneration,
      tts,
      llm,
      total,
      currency: 'USD',
      estimatedTotalTimeSec: 0,
      pricingTier: tierForMonthlyUsd(brief),
      disclaimer: PRICING_DISCLAIMER,
    },
    3,
  );

  return {
    videoClips,
    imageGeneration,
    tts,
    llm,
    total,
    currency: 'USD',
    estimatedTotalTimeSec,
    pricingTier: tierForMonthlyUsd(brief),
    disclaimer: PRICING_DISCLAIMER,
  };
}

export function formatCost(cost: CostBreakdown): string {
  return `$${cost.total.toFixed(2)} ${cost.currency}`;
}

/**
 * ETA estimada en segundos.
 * Heurística: (clipVideoLatency × clips + imagenLatency × imagenes + ttsLatency) / slots paralelos.
 */
export function estimateETA(cost: CostBreakdown, parallelSlots: number = 3): number {
  const slots = Math.max(1, parallelSlots);
  const videoSec = cost.videoClips.count * PRICING_TABLE.avgVeoLatencySec;
  const imgSec = cost.imageGeneration.count * PRICING_TABLE.avgImagenLatencySec;
  const ttsSec = cost.tts.durationSec > 0 ? PRICING_TABLE.avgTTSLatencySec : 0;
  // Trabajo total (suma serial) / slots paralelos
  const total = (videoSec + imgSec + ttsSec) / slots;
  return Math.round(total);
}

export function formatETA(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm.toString().padStart(2, '0')}m`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}