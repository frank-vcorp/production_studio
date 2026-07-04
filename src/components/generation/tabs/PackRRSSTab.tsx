/**
 * PackRRSSTab — S3 tarea 3.5.
 * Permite al usuario elegir ratios + opciones avanzadas y disparar el batch encode.
 */
import { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { SafeZonePreview } from '@/components/export/SafeZonePreview';
import { Button } from '@/components/common/Button';
import { downloadBlob } from '@/utils/download';
import { formatBytes } from '@/utils/format';
import {
  EXPORT_PRESETS,
  SAFE_ZONES,
  DEFAULT_EXPORT_PACK_OPTIONS,
  type AspectRatio,
  type ExportPackOptions,
  type ExportPackOutput,
} from '@/types/export';
import {
  estimateTotalSizeMB,
  estimateEncodingTime,
} from '@/services/exportPresets';
import { batchEncodePack, vttToSrt } from '@/services/exportBatch';
import { telemetry } from '@/services/telemetry';

const ASPECT_RATIOS: AspectRatio[] = ['9:16', '1:1', '4:5', '16:9'];

interface PackRRSSTabProps {
  onSwitchToShare?: () => void;
}

export function PackRRSSTab({ onSwitchToShare }: PackRRSSTabProps): JSX.Element {
  const masterVideo = useProjectStore((s) => s.masterVideo);
  const subtitles = useProjectStore((s) => s.subtitles);
  const voiceover = useProjectStore((s) => s.voiceover);
  const manifest = useProjectStore((s) => s.manifest);
  const brief = useProjectStore((s) => s.brief);
  const brandKit = useProjectStore((s) => s.brandKit);
  const addToast = useUIStore((s) => s.addToast);

  const [options, setOptions] = useState<ExportPackOptions>(DEFAULT_EXPORT_PACK_OPTIONS);
  const [progress, setProgress] = useState<Record<AspectRatio, number>>({} as Record<AspectRatio, number>);
  const [generating, setGenerating] = useState(false);
  const [pack, setPack] = useState<ExportPackOutput | null>(null);

  const masterSize = masterVideo?.size ?? 0;

  const totalSizeMB = useMemo(
    () => estimateTotalSizeMB(options.enabledRatios, 30),
    [options.enabledRatios],
  );
  const encodingTime = useMemo(
    () => estimateEncodingTime(options.enabledRatios),
    [options.enabledRatios],
  );

  const toggleRatio = useCallback((ratio: AspectRatio) => {
    setOptions((prev) => {
      const enabled = prev.enabledRatios.includes(ratio)
        ? prev.enabledRatios.filter((r) => r !== ratio)
        : [...prev.enabledRatios, ratio];
      return { ...prev, enabledRatios: enabled };
    });
  }, []);

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (!masterVideo || options.enabledRatios.length === 0) {
      addToast({ kind: 'warning', message: 'Selecciona al menos un ratio y verifica el master.' });
      return;
    }
    setGenerating(true);
    setProgress({} as Record<AspectRatio, number>);
    try {
      const voAudio = voiceover
        ? { blob: voiceover.audioBlob, filename: 'vo.wav' }
        : undefined;
      const manifestJson = manifest
        ? {
            blob: new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }),
            filename: 'manifest.json',
          }
        : undefined;

      const result = await batchEncodePack({
        masterBlob: masterVideo,
        masterDurationSec: 30,
        options,
        brandKit: brandKit ?? null,
        subtitleVtt: subtitles?.vtt,
        subtitleStyle: subtitles?.style,
        voAudio,
        manifestJson,
        onProgress: (ratio, pct) => {
          setProgress((prev) => ({ ...prev, [ratio]: pct }));
        },
      });
      setPack(result);
      telemetry.record({
        type: 'export_pack_generated',
        ratios: result.videos.map((v) => v.aspectRatio),
        totalMB: result.zip?.totalSizeMB ?? 0,
        timestamp: Date.now(),
      });
      addToast({
        kind: 'success',
        message: `Pack RRSS listo: ${result.videos.length} vídeos + ZIP ${result.zip?.totalSizeMB.toFixed(1) ?? 0} MB.`,
      });
    } catch (e) {
      addToast({ kind: 'error', message: `Pack falló: ${(e as Error).message}` });
    } finally {
      setGenerating(false);
    }
  }, [masterVideo, options, voiceover, manifest, subtitles, brandKit, addToast]);

  const handleDownloadZip = useCallback((): void => {
    if (!pack?.zip) return;
    downloadBlob(pack.zip.blob, pack.zip.filename);
  }, [pack]);

  if (!masterVideo) {
    return (
      <div className="bg-slate-950 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
        Ensambla primero el master 9:16 (tab Master) para habilitar el Pack RRSS.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="pack-rrss-tab">
      <section className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="fa-solid fa-grid-2 text-emerald-400" />
          Ratios disponibles
        </h3>
        <ul className="flex flex-col gap-2 text-xs text-slate-300">
          {ASPECT_RATIOS.map((r) => {
            const p = EXPORT_PRESETS[r];
            const checked = options.enabledRatios.includes(r);
            return (
              <li key={r} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRatio(r)}
                  data-testid={`ratio-${r}`}
                  aria-label={`ratio ${r}`}
                  className="accent-sky-500"
                />
                <span className="font-mono w-12">{r}</span>
                <span className="text-slate-400">
                  {p.width}×{p.height} · {p.platform}
                </span>
                <span className="ml-auto text-slate-500">{p.estimatedSizeMB} MB / 30s</span>
              </li>
            );
          })}
        </ul>

        {/* Safe zones preview */}
        {options.includeSafeZones && options.enabledRatios.length > 0 && (
          <div className="mt-3">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">Safe zones preview</h4>
            <div className="flex flex-wrap gap-3">
              {options.enabledRatios.map((r) => {
                const p = EXPORT_PRESETS[r];
                const sz = SAFE_ZONES[p.platform];
                return (
                  <div key={r} className="flex flex-col items-center gap-1">
                    <SafeZonePreview aspectRatio={r} safeZone={sz} />
                    <span className="text-[10px] text-slate-400">{p.platform}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="fa-solid fa-sliders text-sky-400" />
          Opciones avanzadas
        </h3>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={options.includeSafeZones}
            onChange={(e) => setOptions({ ...options, includeSafeZones: e.target.checked })}
            className="accent-sky-500"
          />
          Incluir safe zones visuales (barras de plataforma)
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={options.includeBurnedSubs}
            onChange={(e) => setOptions({ ...options, includeBurnedSubs: e.target.checked })}
            disabled={!subtitles}
            className="accent-sky-500"
          />
          Quemar subtítulos en video {subtitles ? '' : '(no hay subs en el proyecto)'}
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={options.includeWatermark}
            onChange={(e) => setOptions({ ...options, includeWatermark: e.target.checked })}
            className="accent-sky-500"
          />
          Watermark sutil (logo del cliente, 8% opacity)
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={options.includeManifest}
            onChange={(e) => setOptions({ ...options, includeManifest: e.target.checked })}
            className="accent-sky-500"
          />
          Incluir manifest.json
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={options.includeVOAudio}
            onChange={(e) => setOptions({ ...options, includeVOAudio: e.target.checked })}
            disabled={!voiceover}
            className="accent-sky-500"
          />
          Incluir vo.wav (locución separada) {voiceover ? '' : '(no hay VO en el proyecto)'}
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={options.includeSubtitlesSRT}
            onChange={(e) => setOptions({ ...options, includeSubtitlesSRT: e.target.checked })}
            disabled={!subtitles}
            className="accent-sky-500"
          />
          Incluir subs.srt (subtítulos independientes) {subtitles ? '' : '(no hay subs)'}
        </label>
      </section>

      <section className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex flex-col gap-2">
        <p>
          Estimado: <strong className="text-sky-300">{totalSizeMB.toFixed(1)} MB</strong> totales
          ({options.enabledRatios.length} ratios, {masterSize ? formatBytes(masterSize) : 'master 9:16'}).
        </p>
        <p>
          Tiempo estimado: <strong className="text-sky-300">~{encodingTime}s</strong> (paralelo, 4 workers).
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="success"
          size="lg"
          icon="fa-rocket"
          onClick={handleGenerate}
          loading={generating}
          disabled={generating || options.enabledRatios.length === 0}
          data-testid="generate-pack-btn"
        >
          Generar Pack RRSS ({options.enabledRatios.length} ratios)
        </Button>
        {pack?.zip && !generating && (
          <>
            <Button
              variant="primary"
              size="lg"
              icon="fa-download"
              onClick={handleDownloadZip}
              data-testid="download-zip-btn"
            >
              Descargar ZIP ({pack.zip.totalSizeMB.toFixed(1)} MB)
            </Button>
            {onSwitchToShare && (
              <Button variant="secondary" size="md" icon="fa-share-nodes" onClick={onSwitchToShare}>
                Compartir
              </Button>
            )}
          </>
        )}
      </div>

      {generating && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 flex flex-col gap-2">
          <span className="font-semibold text-sky-300">Generando pack…</span>
          {options.enabledRatios.map((r) => (
            <div key={r} className="flex items-center gap-2" data-testid={`progress-${r}`}>
              <span className="w-12 font-mono">{r}</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((progress[r] ?? 0) * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right">{Math.round((progress[r] ?? 0) * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {pack && !generating && (
        <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 text-xs text-emerald-100">
          ✅ Pack RRSS generado — {pack.videos.length} vídeos
          {pack.subtitles ? ' · subtítulos' : ''}
          {pack.voAudio ? ' · vo.wav' : ''}
          {pack.manifest ? ' · manifest' : ''}
          . ZIP: {pack.zip?.totalSizeMB.toFixed(1) ?? '?'} MB.
        </div>
      )}

      {/* vttToSrt se mantiene exportado por si la UI quiere "Vista previa SRT" en futuro */}
      <span className="hidden" data-vtt-export="vttToSrt">
        {typeof vttToSrt === 'function' ? 'ok' : ''}
      </span>
      {void brief /* referencia para evitar tree-shake warning en builds */}
    </div>
  );
}
