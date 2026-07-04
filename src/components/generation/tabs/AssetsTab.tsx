/**
 * AssetsTab — descarga individual de assets del proyecto:
 *   - master.mp4
 *   - vo.wav (voiceover)
 *   - subs.srt (subtítulos)
 *   - subs.vtt (versión webvtt)
 *   - Por cada clip aprobado: clip_{nodeKey}.mp4
 */

import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/common/Button';
import { downloadBlob } from '@/utils/download';
import { vttToSrt } from '@/services/exportBatch';
import { useMemo } from 'react';

export function AssetsTab(): JSX.Element {
  const masterVideo = useProjectStore((s) => s.masterVideo);
  const voiceover = useProjectStore((s) => s.voiceover);
  const subtitles = useProjectStore((s) => s.subtitles);
  const transitions = useProjectStore((s) => s.transitions);
  const addToast = useUIStore((s) => s.addToast);

  const approvedClips = useMemo(
    () => Array.from(transitions.values()).filter((t) => t.videoBlob && t.status === 'done'),
    [transitions],
  );

  const handleSrtDownload = (): void => {
    if (!subtitles) return;
    try {
      const srt = vttToSrt(subtitles.vtt);
      downloadBlob(
        new Blob([srt], { type: 'application/x-subrip' }),
        `subs-${Date.now()}.srt`,
      );
    } catch (e) {
      addToast({ kind: 'error', message: `Conversión VTT→SRT falló: ${(e as Error).message}` });
    }
  };

  if (!masterVideo && !voiceover && !subtitles && approvedClips.length === 0) {
    return (
      <div className="bg-slate-950 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
        Aún no hay assets. Genera el master, locución o subtítulos primero.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="assets-tab">
      {masterVideo && (
        <AssetCard
          icon="fa-film"
          title="Master 9:16"
          subtitle={`${(masterVideo.size / 1024 / 1024).toFixed(1)} MB`}
          onDownload={() => downloadBlob(masterVideo, `bridge-master-${Date.now()}.mp4`)}
        />
      )}
      {voiceover && (
        <AssetCard
          icon="fa-microphone"
          title="Locución (vo.wav)"
          subtitle={`${voiceover.durationSeconds.toFixed(1)}s`}
          onDownload={() =>
            downloadBlob(voiceover.audioBlob, `vo-${Date.now()}.wav`)
          }
        />
      )}
      {subtitles && (
        <>
          <AssetCard
            icon="fa-closed-captioning"
            title="Subtítulos (VTT)"
            subtitle={`${subtitles.segments.length} segmentos`}
            onDownload={() =>
              downloadBlob(
                new Blob([subtitles.vtt], { type: 'text/vtt' }),
                `subs-${Date.now()}.vtt`,
              )
            }
          />
          <AssetCard
            icon="fa-closed-captioning"
            title="Subtítulos (SRT)"
            subtitle="Conversión VTT → SRT"
            onDownload={handleSrtDownload}
          />
        </>
      )}
      {approvedClips.map((t) => (
        <AssetCard
          key={t.id}
          icon="fa-video"
          title={`Clip ${t.nodeKey}`}
          subtitle={`${(t.videoBlob as Blob).size ? ((t.videoBlob as Blob).size / 1024 / 1024).toFixed(1) : '—'} MB`}
          onDownload={() => downloadBlob(t.videoBlob as Blob, `clip-${t.nodeKey}-${Date.now()}.mp4`)}
        />
      ))}
    </div>
  );
}

interface AssetCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onDownload: () => void;
}

function AssetCard({ icon, title, subtitle, onDownload }: AssetCardProps): JSX.Element {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
      <i className={`fa-solid ${icon} text-sky-400 text-xl`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      <Button variant="secondary" size="sm" icon="fa-download" onClick={onDownload}>
        Descargar
      </Button>
    </div>
  );
}
