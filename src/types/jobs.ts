/**
 * Background jobs — S2 Robustness.
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.2 + 2.3 + 2.1.
 */

import type { AidaNodeKey } from './transition';
import type { KeyframeTransition } from './transition';
import type { Keyframe } from './keyframe';
import type { MasterBrief } from './brief';

/** Tipos de job soportados por la cola (S2). */
export type JobKind =
  | 'video_generation'
  | 'image_generation'
  | 'tts'
  | 'export'
  | 'fallback';

/** Estados posibles de un BackgroundJob. */
export type JobStatus =
  | 'queued'
  | 'active'
  | 'paused'
  | 'done'
  | 'failed'
  | 'fallback_done'
  | 'cancelled';

/** Job individual en la cola. Persistido en IDB. */
export interface BackgroundJob {
  id: string;
  kind: JobKind;
  status: JobStatus;
  /** ID de transición (video_generation) o keyframe (image_generation). */
  transitionId?: string;
  keyframeId?: string;
  /** Payload crudo pasado al worker (transition, kfFrom, kfTo, brief, etc.). */
  payload: JobPayload;
  /** Tracking de reintentos. */
  attempts: number;
  maxAttempts: number;
  /** Métricas de latencia. */
  latencyMs?: number;
  startedAt?: number;
  completedAt?: number;
  /** Info de error en caso de fallo. */
  errorMessage?: string;
  errorCode?: string;
  /** Bandera de fallback activado. */
  fallbackUsed?: boolean;
  fallbackReason?: 'safety' | 'quota' | 'timeout' | 'unknown';
  /** Output serializado (Blob como base64 string para IDB). */
  outputBlobId?: string;
  /** Metadata. */
  createdAt: number;
  updatedAt: number;
}

/** Snapshot reactivo del estado de la cola. */
export interface JobQueueState {
  jobs: BackgroundJob[];
  /** IDs actualmente en ejecución (max 3 por defecto). */
  activeJobs: string[];
  completedJobs: number;
  failedJobs: number;
  totalStartedAt?: number;
  totalCompletedAt?: number;
}

/** Especificación de job al crearlo via createBatch. */
export type JobSpec =
  | {
      kind: 'video_generation';
      transitionId: string;
      transition: KeyframeTransition;
      keyframeFrom: Keyframe;
      keyframeTo: Keyframe;
      brief: MasterBrief | null;
    }
  | {
      kind: 'image_generation';
      keyframeId: string;
      keyframe: Keyframe;
      intent: string;
      brief: MasterBrief | null;
    }
  | {
      kind: 'tts';
      text: string;
      voice: string;
    };

/** Payload persistido en IDB por job. */
export type JobPayload = {
  transitionId?: string;
  keyframeId?: string;
  nodeKey?: AidaNodeKey;
  duration?: number;
  voice?: string;
  text?: string;
  // Cache denormalizado para sobrevivir refresh sin re-leer projectStore.
  // Mantenerlo mínimo: el worker solo necesita lo necesario para re-ejecutar.
  [key: string]: unknown;
};

/** Tipos de error clasificados (VeoClient robusto). */
export type VeoErrorCode = 'safety' | 'quota' | 'timeout' | 'network' | 'unknown';

export interface VeoError extends Error {
  code: VeoErrorCode;
  retryable: boolean;
  attemptNumber?: number;
  details?: unknown;
}

/** Cost breakdown (Pricing). */
export type PricingTier = 'free' | 'tier1' | 'tier2' | 'tier3';

export interface CostLineItem {
  count: number;
  unitPrice: number;
  subtotal: number;
}

export interface CostBreakdown {
  videoClips: CostLineItem;
  imageGeneration: CostLineItem;
  tts: { durationSec: number; unitPricePerSec: number; subtotal: number };
  llm: { tokens: number; unitPricePer1k: number; subtotal: number };
  music?: { durationSec: number; unitPricePerSec: number; subtotal: number };
  total: number;
  currency: 'USD';
  estimatedTotalTimeSec: number;
  pricingTier: PricingTier;
  disclaimer: string;
}

/** Constantes heredadas de S1 (compatibilidad de imports). */
export const VEO_PRICING_PER_SECOND_USD = 0.10;
export const IMAGEN_PRICING_PER_IMAGE_USD = 0.04;
export const VISION_PRICING_PER_IMAGE_USD = 0.001;
export const TTS_PRICING_PER_1K_CHARS_USD = 0.03;

/** Versión del schema de jobs en IDB (para migraciones futuras). */
export const JOB_QUEUE_SCHEMA_VERSION = 1;