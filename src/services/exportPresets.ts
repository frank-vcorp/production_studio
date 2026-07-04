/**
 * exportPresets — utilidades de consulta sobre EXPORT_PRESETS.
 * Spec: SPEC-S3-EXPORT §Tarea 3.1.
 */

import {
  EXPORT_PRESETS,
  type AspectRatio,
  type S3ExportPreset,
} from '@/types/export';

/** Devuelve el preset para un ratio. Throws si el ratio no está en la tabla. */
export function getPreset(ratio: AspectRatio): S3ExportPreset {
  const preset = EXPORT_PRESETS[ratio];
  if (!preset) {
    throw new Error(`Unknown aspect ratio: ${ratio}`);
  }
  return preset;
}

/** Lista de todos los presets disponibles (ordenados por aspect ratio). */
export function listAllPresets(): S3ExportPreset[] {
  return Object.values(EXPORT_PRESETS);
}

/** Estima el tamaño total del pack (en MB) para los ratios activados y duración dada. */
export function estimateTotalSizeMB(enabled: AspectRatio[], durationSec: number): number {
  if (enabled.length === 0 || durationSec <= 0) return 0;
  const SECONDS_REF = 30;
  return enabled.reduce((acc, r) => {
    const preset = getPreset(r);
    return acc + (preset.estimatedSizeMB * durationSec) / SECONDS_REF;
  }, 0);
}

/**
 * Estima el tiempo total de encoding (segundos) cuando se paralelizan los encodes.
 *
 * Modelo:
 * - 1 encode base = ~12s (single ratio)
 * - cada encode adicional en paralelo suma solo +2s (overhead de scheduling)
 * - secuencial sería 12 * N (no es nuestro caso porque usamos Workers paralelos)
 *
 * Si N===0 → 0. Si N===1 → 12s.
 */
export function estimateEncodingTime(enabled: AspectRatio[]): number {
  const n = enabled.length;
  if (n === 0) return 0;
  const BASE_TIME_PER_RATIO = 12;
  return BASE_TIME_PER_RATIO + (n - 1) * 2;
}
