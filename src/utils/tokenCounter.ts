/**
 * Token Counter — estimación aproximada de tokens para prompts Veo/Gemini.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.2 + ARCH-20260703-04.
 *
 * Aproximación: ~4 caracteres = 1 token (Gemini Pro tokenizer es similar).
 * NO usa tiktoken (overkill para límites Veo). Suficiente para advertencia temprana.
 */

/** Límite duro del prompt Veo (modelo veo-3.1). */
export const TOKEN_LIMIT = 2048;

/** Umbral de advertencia (≈88% del límite). */
export const TOKEN_WARNING = 1800;

export type TokenLevel = 'safe' | 'warning' | 'danger';

export interface TokenStatus {
  level: TokenLevel;
  message: string;
  color: 'emerald' | 'amber' | 'red';
}

/**
 * Estima el número de tokens en un texto.
 * Aproximación: 1 token ≈ 4 caracteres (con redondeo hacia arriba).
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Determina el estado visual (color + mensaje) según el conteo de tokens.
 *
 * - safe (< TOKEN_WARNING)   → emerald "OK"
 * - warning (>= WARNING)     → amber  "Cerca del límite"
 * - danger (>= LIMIT)        → red    "Excede límite"
 */
export function tokenStatus(tokens: number): TokenStatus {
  if (tokens >= TOKEN_LIMIT) {
    return { level: 'danger', message: 'Excede límite', color: 'red' };
  }
  if (tokens >= TOKEN_WARNING) {
    return { level: 'warning', message: 'Cerca del límite', color: 'amber' };
  }
  return { level: 'safe', message: 'OK', color: 'emerald' };
}