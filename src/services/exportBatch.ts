/**
 * exportBatch — encode paralelo de master.mp4 a N aspect ratios vía Workers FFmpeg.
 *
 * Spec: SPEC-S3-EXPORT §Tarea 3.3.
 *
 * Estrategia:
 * - Spawn 1 Worker FFmpeg POR ratio (true parallelism; FFmpeg.wasm es single-threaded)
 * - Cada Worker se inicializa con INIT → EXPORT_RATIO → terminate en bloque try/finally
 * - Acumula vídeos (no fallidos), construye ZIP al final
 * - abortSignal: si se dispara entremedio, workers restantes se cancelan via terminate
 *
 * Notas críticas:
 * - Worker lifecycle: SIEMPRE try/finally con terminate() — sino memory leak.
 * - Outputs (videos) se devuelven aunque algunos ratios fallen (los exitosos).
 * - El ZIP se construye aunque la collección esté vacía (devuelve ZIP vacío con README).
 */

import {
  type AspectRatio,
  type ExportPackOptions,
  type ExportPackOutput,
} from '@/types/export';
import type { SubtitleStyle, BrandKit } from '@/types/project';
import { getPreset } from './exportPresets';
import { buildExportPackZip } from './zipHelper';

interface EncodeResult {
  aspectRatio: AspectRatio;
  blob: Blob;
  filename: string;
}

interface RunContext {
  worker: Worker;
  requestId: string;
}

function newRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Crea 1 Worker FFmpeg dedicado y le envía INIT.
 * Resuelve cuando el worker está listo (type=READY).
 */
function spawnInitializedWorker(): { worker: Worker; ready: Promise<void> } {
  const worker = new Worker(new URL('../workers/ffmpeg.worker.ts', import.meta.url), {
    type: 'module',
  });
  const ready = new Promise<void>((resolve, reject) => {
    const id = newRequestId();
    const onMsg = (e: MessageEvent): void => {
      const { type, requestId: rid } = e.data ?? {};
      if (rid !== id) return;
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      if (type === 'READY') resolve();
      else if (type === 'ERROR') reject(new Error(String(e.data?.payload ?? 'init failed')));
    };
    const onErr = (err: ErrorEvent): void => {
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      reject(new Error(err.message ?? 'worker init error'));
    };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);
    worker.postMessage({ type: 'INIT', requestId: id });
  });
  return { worker, ready };
}

/** Envía EXPORT_RATIO a un worker, devuelve Blob. */
function runExportRatio(
  ctx: RunContext,
  payload: unknown,
  outputName: string,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const { worker, requestId } = ctx;
    const onMsg = (e: MessageEvent): void => {
      const { type, requestId: rid, payload: p } = e.data ?? {};
      if (rid !== requestId) {
        // Progress messages usan el mismo requestId para no contaminar
        if (type === 'PROGRESS' && typeof p?.progress === 'number') {
          onProgress(Math.max(0, Math.min(1, p.progress)));
        }
        return;
      }
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      if (type === 'RESULT') resolve(p as Blob);
      else if (type === 'ERROR') reject(new Error(String(p ?? 'export failed')));
    };
    const onErr = (err: ErrorEvent): void => {
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      reject(new Error(err.message ?? 'worker runtime error'));
    };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);
    worker.postMessage({
      type: 'EXPORT_RATIO',
      requestId,
      payload,
      outputName,
    });
  });
}

/** Cierra limpiamente un Worker. */
function terminateWorker(w: Worker): void {
  try {
    w.postMessage({ type: 'TERMINATE' });
  } catch {
    /* ignore */
  }
  try {
    w.terminate();
  } catch {
    /* ignore */
  }
}

/** Encode 1 ratio: spawn worker + init + export + terminate. */
async function encodeOneRatio(
  ratio: AspectRatio,
  masterBlob: Blob,
  options: ExportPackOptions,
  subtitleStyle: SubtitleStyle | null,
  vtt: string | null,
  onProgress: (pct: number) => void,
  abortSignal?: AbortSignal,
): Promise<EncodeResult | null> {
  if (abortSignal?.aborted) return null;
  const preset = getPreset(ratio);
  const { worker, ready } = spawnInitializedWorker();

  try {
    await ready;
    if (abortSignal?.aborted) return null;

    const payload = {
      masterBlob,
      preset: {
        aspectRatio: ratio,
        width: preset.width,
        height: preset.height,
        bitrate: preset.bitrate,
        audioBitrate: preset.audioBitrate,
      },
      burnSubs:
        options.includeBurnedSubs && vtt && subtitleStyle
          ? {
              vtt,
              fontFamily: subtitleStyle.fontFamily,
              fontSize: subtitleStyle.fontSize,
              color: subtitleStyle.color,
              outline: subtitleStyle.outline,
              shadow: subtitleStyle.shadow,
              marginV: subtitleStyle.marginV,
              bold: subtitleStyle.bold,
            }
          : null,
      watermark:
        options.includeWatermark && options.watermarkImageBase64
          ? {
              base64Png: options.watermarkImageBase64,
              opacity: options.watermarkOpacity,
              position: options.watermarkPosition,
            }
          : null,
    };

    const filename = `master_${ratio.replace(':', 'x')}.mp4`;
    const blob = await runExportRatio(
      { worker, requestId: newRequestId() },
      payload,
      filename,
      onProgress,
    );
    return { aspectRatio: ratio, blob, filename };
  } finally {
    terminateWorker(worker);
  }
}

export interface BatchEncodeInput {
  masterBlob: Blob;
  masterDurationSec: number;
  options: ExportPackOptions;
  brandKit: BrandKit | null;
  subtitleVtt?: string;
  subtitleStyle?: SubtitleStyle;
  voAudio?: { blob: Blob; filename: string };
  manifestJson?: { blob: Blob; filename: string };
  onProgress?: (ratio: AspectRatio, percent: number) => void;
  abortSignal?: AbortSignal;
}

/**
 * Encode paralelo: lanza N Workers (uno por ratio), espera a todos (Promise.allSettled
 * para no perder los exitosos si uno falla), construye ZIP final con subs+VO+manifest.
 *
 * Brand kit / subtitle style / VO audio / manifest se aceptan como parámetros
 * opcionales para evitar acoplamiento con projectStore (testable).
 */
export async function batchEncodePack(input: BatchEncodeInput): Promise<ExportPackOutput> {
  const {
    masterBlob,
    masterDurationSec,
    options,
    subtitleVtt,
    subtitleStyle,
    voAudio,
    manifestJson,
    onProgress,
    abortSignal,
  } = input;

  const videosAcc: EncodeResult[] = [];

  // VTT → SRT (S3 incluye subs.srt en el ZIP; el worker usa VTT internamente para burn)
  const srtBlob = subtitleVtt && options.includeSubtitlesSRT
    ? new Blob([vttToSrt(subtitleVtt)], { type: 'application/x-subrip' })
    : null;

  // Lanza en paralelo — Promise.allSettled para no abortar todo si 1 falla
  const tasks = options.enabledRatios.map((ratio) =>
    encodeOneRatio(
      ratio,
      masterBlob,
      options,
      subtitleStyle ?? null,
      subtitleVtt ?? null,
      (p) => onProgress?.(ratio, p),
      abortSignal,
    )
      .then((r) => {
        if (r) videosAcc.push(r);
      })
      .catch((e: Error) => {
        console.warn(`[exportBatch] ratio=${ratio} failed: ${e.message}`);
      }),
  );

  await Promise.allSettled(tasks);

  // Orden estable: mismo orden que options.enabledRatios
  const ordered = videosAcc.sort(
    (a, b) => options.enabledRatios.indexOf(a.aspectRatio) - options.enabledRatios.indexOf(b.aspectRatio),
  );

  const videos = ordered.map((r) => ({
    aspectRatio: r.aspectRatio,
    blob: r.blob,
    sizeMB: r.blob.size / (1024 * 1024),
    filename: r.filename,
  }));

  const subs = srtBlob
    ? { srtBlob, filename: 'subs.srt' }
    : undefined;
  const vo = voAudio && options.includeVOAudio
    ? { wavBlob: voAudio.blob, filename: voAudio.filename }
    : undefined;
  const manifest = manifestJson && options.includeManifest
    ? { jsonBlob: manifestJson.blob, filename: manifestJson.filename }
    : undefined;

  const partial: Partial<ExportPackOutput> = {
    videos,
    subtitles: subs,
    voAudio: vo,
    manifest,
  };

  const zip = await buildExportPackZip(partial as ExportPackOutput, options, masterDurationSec);

  return {
    videos,
    subtitles: subs,
    voAudio: vo,
    manifest,
    zip,
    generatedAt: Date.now(),
    totalDuration: masterDurationSec,
  };
}

/**
 * Conversor robusto VTT → SRT (subrip).
 *
 * SRT requiere:
 *   - Contador 1-based en línea separada antes de cada cue
 *   - Coma decimal en timestamps (VTT usa punto)
 *   - NO header "WEBVTT" (VTT lo incluye)
 *   - NO bloque STYLE/STNOTE/REGION (VTT los puede tener)
 *
 * VTT es super-set de WebVTT; SRT es sub-set estricto.
 * Ref: https://www.matroska.org/technical/subtitles.html#srt-subtitles
 *
 * Estrategia:
 *   1. Parsear línea por línea buscando patrones timestamp "HH:MM:SS.mmm --> HH:MM:SS.mmm"
 *   2. Filtrar blocks STYLE/STNOTE/REGION (no soportados en SRT)
 *   3. Convertir comas decimales
 *   4. Numerar 1-based
 *   5. Si falla, devolver el VTT original con header "SUBRIP SRT fallback"
 */
export function vttToSrt(vtt: string): string {
  try {
    const lines = vtt.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let counter = 1;
    let i = 0;
    const isBlockHeader = (l: string): boolean =>
      /^(STYLE|STNOTE|REGION|NOTE)(\s|$)/i.test(l);
    const isTimestamp = (l: string): boolean => /-->/.test(l);
    // Skip header "WEBVTT" + metadata + blocks STYLE/STNOTE/REGION
    if (lines[0]?.startsWith('WEBVTT')) {
      i++; // skip WEBVTT header line
      while (i < lines.length && lines[i]?.trim() !== '') {
        i++; // skip metadata lines until blank
      }
    }
    // Skip STYLE/STNOTE/REGION blocks (multi-line until blank)
    while (i < lines.length) {
      const line = lines[i]?.trim() ?? '';
      if (!line) {
        i++;
        continue;
      }
      if (isBlockHeader(line)) {
        // Skip whole block until blank line
        while (i < lines.length && lines[i]?.trim() !== '') i++;
        continue;
      }
      if (isTimestamp(line)) {
        // Cue: optional identifier line first (anything before "-->" on previous line)
        // timestamps line: "HH:MM:SS.mmm --> HH:MM:SS.mmm [cue settings]"
        // Strip cue settings (after timestamp); keep only the timestamp range
        const tsMatch = line.match(
          /^([\d:.]+)\s*-->\s*([\d:.]+)/,
        );
        if (!tsMatch) {
          // Bad timestamp — skip line
          i++;
          continue;
        }
        const startTs = tsMatch[1]!.replace('.', ',');
        const endTs = tsMatch[2]!.replace('.', ',');
        const safeStart = normalizeTimestamp(startTs);
        const safeEnd = normalizeTimestamp(endTs);
        // Write SRT cue
        out.push(String(counter++));
        out.push(`${safeStart} --> ${safeEnd}`);
        i++;
        // Capture text lines until blank (preserve multi-line cue text)
        while (i < lines.length && lines[i]?.trim() !== '') {
          out.push(lines[i] ?? '');
          i++;
        }
        out.push(''); // blank separator between cues
      } else {
        // Skip identifier lines (any non-blank, non-timestamp, non-block line between cues)
        i++;
      }
    }
    return out.join('\n').trimEnd() + '\n';
  } catch (err) {
    // Fallback best-effort: prefix with error note
    console.warn('[vttToSrt] Convertion failed, returning VTT as-is:', err);
    return `; SRT conversion failed, returning VTT original\n\n${vtt}`;
  }
}

/**
 * Normaliza timestamp VTT/SRT al formato `HH:MM:SS,mmm` con padding correcto.
 * Acepta entradas como "0:1.5" (1.5s) o "00:00:01.500" y normaliza.
 */
function normalizeTimestamp(ts: string): string {
  // Reemplazar primer "." por "," (para decimales)
  const normalized = ts.replace(/\.(\d+)$/, ',$1');
  // Parsear como componentes
  const m = normalized.match(/^(\d{1,2}):(\d{2}):(\d{2}),(\d{1,3})$/);
  if (m) {
    const [, hh, mm, ss, ms] = m;
    const msPadded = ms.padEnd(3, '0').slice(0, 3);
    return `${hh.padStart(2, '0')}:${mm}:${ss},${msPadded}`;
  }
  // Si ya estaba sin HH:, parsear como MM:SS,mmm
  const m2 = normalized.match(/^(\d{1,2}):(\d{2}),(\d{1,3})$/);
  if (m2) {
    const [, mm, ss, ms] = m2;
    return `00:${mm.padStart(2, '0')}:${ss},${ms.padEnd(3, '0').slice(0, 3)}`;
  }
  return ts; // Best effort fallback
}
