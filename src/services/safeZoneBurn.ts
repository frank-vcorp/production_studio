/**
 * safeZoneBurn — generador de filter graph FFmpeg para quemar safe zones
 * en el MP4 final (opcional, no incluido por default en el batch).
 *
 * Devuelve la cadena `-vf` lista para pasar a ffmpegService.execute()
 * cuando se quiere que el video final tenga pintadas las safe zones como
 * referencia visual de edición.
 *
 * Spec: SPEC-S3-EXPORT §Tarea 3.2.
 */

import type { SafeZone, S3ExportPreset } from '@/types/export';

/** Construye un filter FFmpeg que pinta cajas rojas/ámbar según safe zones. */
export function buildSafeZoneDrawboxFilter(
  safeZone: SafeZone,
  preset: S3ExportPreset,
): string {
  const parts: string[] = [];
  if (safeZone.topBarHeight > 0) {
    parts.push(
      `drawbox=x=0:y=0:w=iw:h=${safeZone.topBarHeight}:color=red@0.15:t=fill`,
    );
  }
  if (safeZone.bottomBarHeight > 0) {
    parts.push(
      `drawbox=x=0:y=ih-${safeZone.bottomBarHeight}:w=iw:h=${safeZone.bottomBarHeight}:color=red@0.15:t=fill`,
    );
  }
  if (safeZone.sideSafeZone > 0) {
    parts.push(
      `drawbox=x=0:y=0:w=${safeZone.sideSafeZone}:h=ih:color=yellow@0.10:t=fill`,
    );
    parts.push(
      `drawbox=x=iw-${safeZone.sideSafeZone}:y=0:w=${safeZone.sideSafeZone}:h=ih:color=yellow@0.10:t=fill`,
    );
  }
  void preset; // preset reservado para futuros presets con safe zone específica
  return parts.join(',');
}

/** Helper: devuelve true si el filtro no hace nada (ninguna zona activa). */
export function hasSafeZoneContent(safeZone: SafeZone): boolean {
  return safeZone.topBarHeight + safeZone.bottomBarHeight + safeZone.sideSafeZone > 0;
}
