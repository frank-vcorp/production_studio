/**
 * zipHelper — empaqueta vídeos + subs + VO + manifest en un ZIP descargable.
 * Spec: SPEC-S3-EXPORT §Tarea 3.6.
 *
 * - DEFLATE nivel 6 (balance típico size/CPU).
 * - README.txt automático con inventario del pack.
 * - Para outputs >100MB considerar `generateInternalStream()` (no habilitado aquí,
 *   los packs de demo son ≤80MB para 30s).
 */

import JSZip from 'jszip';
import type { ExportPackOutput, ExportPackOptions } from '@/types/export';

export interface PackZipResult {
  blob: Blob;
  filename: string;
  totalSizeMB: number;
}

/**
 * Construye el ZIP final a partir del pack parcial.
 * `masterDurationSec` se usa para calcular el README inventory.
 */
export async function buildExportPackZip(
  pack: Partial<ExportPackOutput>,
  _options?: ExportPackOptions,
  masterDurationSec = 0,
): Promise<PackZipResult> {
  void _options; // reservado para "includeSafeZoneOverlayPack=boolean" futuro
  const zip = new JSZip();
  const nowIso = new Date().toISOString();
  const filenameStamp = nowIso.slice(0, 19).replace(/[:T]/g, '-');

  pack.videos?.forEach((v) => {
    zip.file(v.filename, v.blob);
  });
  if (pack.subtitles) {
    zip.file(pack.subtitles.filename, pack.subtitles.srtBlob);
  }
  if (pack.voAudio) {
    zip.file(pack.voAudio.filename, pack.voAudio.wavBlob);
  }
  if (pack.manifest) {
    zip.file(pack.manifest.filename, pack.manifest.jsonBlob);
  }

  // README automático
  const totalSizeMB = (pack.videos ?? []).reduce((acc, v) => acc + v.sizeMB, 0);
  const platformLines = (pack.videos ?? [])
    .map(
      (v) =>
        `- ${v.aspectRatio.padEnd(6)} ${v.filename} (${v.sizeMB.toFixed(1)} MB)`,
    )
    .join('\n');

  const readme =
    `Bridge Creative Engine — Export Pack\n` +
    `Generated: ${nowIso}\n` +
    `Master duration: ~${masterDurationSec}s\n` +
    `Total videos: ${pack.videos?.length ?? 0}\n` +
    `Total videos size: ${totalSizeMB.toFixed(1)} MB\n` +
    `Includes subtitles: ${pack.subtitles ? 'yes' : 'no'}\n` +
    `Includes voiceover: ${pack.voAudio ? 'yes' : 'no'}\n` +
    `Includes manifest: ${pack.manifest ? 'yes' : 'no'}\n` +
    `\n` +
    `Platforms / Aspect Ratios:\n` +
    `${platformLines}\n` +
    `\n` +
    `For support: https://github.com/frank-coder-engine/bridge-creative-engine\n`;
  zip.file('README.txt', readme);

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    filename: `bridge_pack_${filenameStamp}.zip`,
    totalSizeMB: blob.size / (1024 * 1024),
  };
}
