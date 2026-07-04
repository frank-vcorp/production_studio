/**
 * Export & share types (S3 work, referenciados en S1 ExportCenter).
 *
 * S1/S2 expuso tipos mínimos en ./project (ExportPresetName, ExportPreset,
 * ExportPackEntry, ExportPack) — los mantenemos re-exportados para no romper
 * consumidores existentes.
 *
 * S3 añade tipos específicos de multi-formato (EXPORT_PRESETS, SAFE_ZONES,
 * AspectRatio, SafeZone, ExportPackOptions, ExportPackOutput). Estas adiciones
 * son las que usa el ExportCenter rediseñado con tabs Master/PackRRSS/Assets/
 * Manifest/Share.
 * Spec: SPEC-S3-EXPORT.md §Tarea 3.1 + 3.5.
 */

// Re-exports S1/S2 (preservar contrato público)
export type { ExportPreset, ExportPack, ExportPackEntry, ExportPresetName } from './project';

// === S3 NUEVO: multi-formato RRSS ===

/** Aspect ratios soportados por el pack RRSS. */
export type AspectRatio = '9:16' | '1:1' | '4:5' | '16:9';

/** Plataformas usadas en safe zones y metadatos. */
export type Platform =
  | 'reels'
  | 'tiktok'
  | 'shorts'
  | 'feed_ig_square'
  | 'feed_ig_portrait'
  | 'youtube'
  | 'facebook';

/** Modo de crop del preset (center por default para S3). */
export type CropMode = 'center' | 'face' | 'smart';

/** Preset por ratio con metadatos de bitrate y tamaño estimado (30s). */
export interface S3ExportPreset {
  id: string;
  platform: Platform;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  cropMode: CropMode;
  bitrate: number; // kbps video
  audioBitrate: number; // kbps audio
  estimatedSizeMB: number; // Para 30s
}

/** Safe zones de plataforma (overlays que NO debe ocupar contenido crítico). */
export interface SafeZone {
  platform: Platform;
  topBarHeight: number; // px reservados arriba (típicamente username)
  bottomBarHeight: number; // px reservados abajo (CTA/buttons)
  sideSafeZone: number; // px reservados a los lados
  description: string;
}

/** Tabla canónica de presets por ratio. */
export const EXPORT_PRESETS: Record<AspectRatio, S3ExportPreset> = {
  '9:16': {
    id: 'reels_tiktok_shorts',
    platform: 'reels',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    cropMode: 'center',
    bitrate: 5000,
    audioBitrate: 128,
    estimatedSizeMB: 19,
  },
  '1:1': {
    id: 'feed_ig_square',
    platform: 'feed_ig_square',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    cropMode: 'center',
    bitrate: 4000,
    audioBitrate: 128,
    estimatedSizeMB: 15,
  },
  '4:5': {
    id: 'feed_ig_portrait',
    platform: 'feed_ig_portrait',
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
    cropMode: 'center',
    bitrate: 4000,
    audioBitrate: 128,
    estimatedSizeMB: 15,
  },
  '16:9': {
    id: 'youtube_facebook',
    platform: 'youtube',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    cropMode: 'center',
    bitrate: 6000,
    audioBitrate: 192,
    estimatedSizeMB: 23,
  },
} as const;

/** Tabla canónica de safe zones por plataforma. */
export const SAFE_ZONES: Record<Platform, SafeZone> = {
  reels: {
    platform: 'reels',
    topBarHeight: 0,
    bottomBarHeight: 250,
    sideSafeZone: 50,
    description: 'IG Reels: 250px bottom reservado para description, captions & username',
  },
  tiktok: {
    platform: 'tiktok',
    topBarHeight: 100,
    bottomBarHeight: 350,
    sideSafeZone: 30,
    description: 'TikTok: username top, descripción + botón share bottom',
  },
  shorts: {
    platform: 'shorts',
    topBarHeight: 50,
    bottomBarHeight: 100,
    sideSafeZone: 30,
    description: 'YouTube Shorts: subscribe button bottom',
  },
  feed_ig_square: {
    platform: 'feed_ig_square',
    topBarHeight: 0,
    bottomBarHeight: 60,
    sideSafeZone: 30,
    description: 'IG Feed square: small bottom margin',
  },
  feed_ig_portrait: {
    platform: 'feed_ig_portrait',
    topBarHeight: 0,
    bottomBarHeight: 80,
    sideSafeZone: 30,
    description: 'IG Feed portrait: 80px bottom margin',
  },
  youtube: {
    platform: 'youtube',
    topBarHeight: 0,
    bottomBarHeight: 60,
    sideSafeZone: 0,
    description: 'YouTube landscape: title overlay area bottom',
  },
  facebook: {
    platform: 'facebook',
    topBarHeight: 0,
    bottomBarHeight: 80,
    sideSafeZone: 0,
    description: 'Facebook Feed: name + caption bottom',
  },
} as const;

/** Opciones configurables del Pack RRSS. */
export interface ExportPackOptions {
  enabledRatios: AspectRatio[];
  includeSafeZones: boolean;
  includeBurnedSubs: boolean;
  includeWatermark: boolean;
  watermarkImageBase64?: string;
  watermarkOpacity: number; // 0-1, default 0.08
  watermarkPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  includeManifest: boolean;
  includeVOAudio: boolean;
  includeSubtitlesSRT: boolean;
}

/** Defaults sensatos para el tab Pack RRSS. */
export const DEFAULT_EXPORT_PACK_OPTIONS: ExportPackOptions = {
  enabledRatios: ['9:16', '1:1', '4:5'],
  includeSafeZones: true,
  includeBurnedSubs: false,
  includeWatermark: true,
  watermarkOpacity: 0.08,
  watermarkPosition: 'bottom-right',
  includeManifest: true,
  includeVOAudio: true,
  includeSubtitlesSRT: true,
};

/** Output de ExportPackOptions.batchEncode(). */
export interface ExportPackOutput {
  videos: {
    aspectRatio: AspectRatio;
    blob: Blob;
    sizeMB: number;
    filename: string;
  }[];
  subtitles?: { srtBlob: Blob; filename: string };
  voAudio?: { wavBlob: Blob; filename: string };
  manifest?: { jsonBlob: Blob; filename: string };
  zip?: { blob: Blob; filename: string; totalSizeMB: number };
  generatedAt: number;
  totalDuration: number; // segundos
}
