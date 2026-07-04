/**
 * SafeZonePreview — overlay visual de safe zones de plataforma sobre el preview.
 *
 * Renderiza una caja proporcional al aspectRatio del preset con bandas
 * coloreadas (top rojo, bottom amber, sides yellow) según la SafeZone pasada.
 *
 * Spec: SPEC-S3-EXPORT §Tarea 3.2.
 * Esta vista es SOLO visual (se renderiza en el tab Pack RRSS); el burn-in
 * real al MP4 ocurre vía safeZoneBurn.applySafeZoneBurnFilter().
 */

import type { AspectRatio, SafeZone } from '@/types/export';
import { EXPORT_PRESETS } from '@/types/export';

export interface SafeZonePreviewProps {
  aspectRatio: AspectRatio;
  safeZone: SafeZone;
  /** Ancho máx del preview en px (default 240 — entra en grid del tab). */
  maxWidth?: number;
}

export function SafeZonePreview({
  aspectRatio,
  safeZone,
  maxWidth = 240,
}: SafeZonePreviewProps): JSX.Element {
  const preset = EXPORT_PRESETS[aspectRatio];

  const topPct = (safeZone.topBarHeight / preset.height) * 100;
  const bottomPct = (safeZone.bottomBarHeight / preset.height) * 100;
  const sidePct = (safeZone.sideSafeZone / preset.width) * 100;

  return (
    <div
      className="relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden"
      style={{ aspectRatio: aspectRatio.replace(':', '/'), maxWidth }}
      data-testid={`safe-zone-preview-${aspectRatio}`}
    >
      {/* Fondo "video" simulado */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />

      {/* Top safe zone (rojo) */}
      {topPct > 0 && (
        <div
          className="absolute top-0 left-0 right-0 bg-red-500/20 border-b-2 border-red-500/50"
          style={{ height: `${topPct}%` }}
          aria-label={`Top safe zone ${safeZone.topBarHeight}px`}
        >
          <span className="absolute top-1 left-1 text-[9px] font-bold text-red-300 px-1 bg-slate-950/70 rounded">
            {safeZone.topBarHeight}px (no captions)
          </span>
        </div>
      )}

      {/* Bottom safe zone (amber) */}
      {bottomPct > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-amber-500/20 border-t-2 border-amber-500/50"
          style={{ height: `${bottomPct}%` }}
          aria-label={`Bottom safe zone ${safeZone.bottomBarHeight}px`}
        >
          <span className="absolute bottom-1 right-1 text-[9px] font-bold text-amber-300 px-1 bg-slate-950/70 rounded">
            {safeZone.bottomBarHeight}px
          </span>
        </div>
      )}

      {/* Side safe zones (yellow) — solo si >0 */}
      {sidePct > 0 && (
        <>
          <div
            className="absolute top-0 bottom-0 left-0 bg-yellow-500/10"
            style={{ width: `${sidePct}%` }}
            aria-label={`Left safe zone ${safeZone.sideSafeZone}px`}
          />
          <div
            className="absolute top-0 bottom-0 right-0 bg-yellow-500/10"
            style={{ width: `${sidePct}%` }}
            aria-label={`Right safe zone ${safeZone.sideSafeZone}px`}
          />
        </>
      )}

      {/* Ratio label */}
      <div className="absolute top-2 right-2 text-xs font-bold text-white bg-slate-950/80 px-2 py-0.5 rounded">
        {aspectRatio}
      </div>
    </div>
  );
}
