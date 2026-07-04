/**
 * Background jobs (S2, stub S1).
 */
import type { AidaNodeKey } from './transition';
import type { ExportPresetName } from './project';

export type JobKind =
  | 'analyze_keyframe'
  | 'generate_keyframe_out'
  | 'generate_transition'
  | 'assemble_master'
  | 'export_pack';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundJob {
  id: string;
  kind: JobKind;
  status: JobStatus;
  progress: number;        // 0-1
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
  payload: {
    transitionId?: string;
    keyframeId?: string;
    nodeKey?: AidaNodeKey;
    presets?: ExportPresetName[];
  };
  result?: unknown;
}

export interface CostBreakdown {
  byNode: Record<string, { operations: number; estimatedUSD: number }>;
  totalUSD: number;
  generatedAt: number;
}

export const VEO_PRICING_PER_SECOND_USD = 0.10;     // aprox, validar en S2 con doc oficial
export const IMAGEN_PRICING_PER_IMAGE_USD = 0.04;
export const VISION_PRICING_PER_IMAGE_USD = 0.001;
export const TTS_PRICING_PER_1K_CHARS_USD = 0.03;
