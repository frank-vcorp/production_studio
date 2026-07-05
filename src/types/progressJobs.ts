/**
 * Progress jobs — ARCH-20260704-09.
 * Indicadores de carga persistentes para análisis de imagen (Vision) y
 * generación de clip (Veo). Estado EFÍMERO (no se persiste en IDB).
 * Spec: SPEC-20260704-09 §4.
 */

export type AnalysisState = 'idle' | 'analyzing' | 'done' | 'failed';

export interface AnalysisJob {
  keyframeId: string;
  state: AnalysisState;
  startedAt?: number;
  finishedAt?: number;
  errorMessage?: string;
}

export type GenerationState = 'idle' | 'generating' | 'done' | 'failed';

export interface GenerationJob {
  transitionId: string;
  state: GenerationState;
  startedAt?: number;
  finishedAt?: number;
  attempts?: number;
  etaSeconds?: number;
  errorMessage?: string;
}