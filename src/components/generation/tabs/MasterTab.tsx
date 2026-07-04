/**
 * MasterTab — generación y descarga del master 9:16.
 * Mantiene 1:1 la funcionalidad S1/S2 (Ensamblar / Generar Veo / Lote).
 */
import { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { ffmpegService } from '@/services/ffmpeg';
import { generateTransition } from '@/services/gemini/video';
import { jobQueue } from '@/services/jobQueue';

import { useJobProgress } from '@/hooks/useJobProgress';
import { requestNotificationPermission } from '@/services/notification';
import { Button } from '@/components/common/Button';
import { downloadBlob, downloadJSON } from '@/utils/download';
import { formatBytes } from '@/utils/format';
import { CostEstimatorModal } from '@/components/generation/CostEstimatorModal';
import { JobsPanel } from '@/components/generation/JobsPanel';
import type { CostEstimatorInput } from '@/services/costEstimator';
import type { JobSpec } from '@/types/jobs';
import type { KeyframeTransition } from '@/types/transition';
import type { ProjectState } from '@/types/project';
import type { TransitionStatus } from '@/types/transition';

function markTransitionStatus(id: string, status: TransitionStatus): void {
  useProjectStore.setState((s) => {
    const cur = s.transitions.get(id);
    if (!cur) return s;
    const next = new Map(s.transitions);
    next.set(id, { ...cur, status });
    return { transitions: next };
  });
}

function storeClipAndMarkDone(id: string, blob: Blob, url: string): void {
  useProjectStore.setState((s: ProjectState) => {
    const cur = s.transitions.get(id);
    if (!cur) return s;
    const nextClipMap = new Map(s.clips);
    nextClipMap.set(id, blob);
    const nextTransitions = new Map(s.transitions);
    nextTransitions.set(id, {
      ...cur,
      videoBlob: blob,
      videoUrl: url,
      status: 'done' as TransitionStatus,
      generatedAt: Date.now(),
    });
    return { clips: nextClipMap, transitions: nextTransitions };
  });
}

function markTransitionFailed(id: string, message: string): void {
  useProjectStore.setState((s) => {
    const cur = s.transitions.get(id);
    if (!cur) return s;
    const next = new Map<KeyframeTransition['id'], KeyframeTransition>(s.transitions);
    next.set(id, { ...cur, status: 'failed', errorMessage: message });
    return { transitions: next };
  });
}

const NODE_ORDER: Array<{ node: 'bumper' | 'atencion' | 'interes' | 'deseo' | 'accion' | 'cta'; label: string; duration: number; kf: 'bumper_start' | 'atencion_in' | 'interes_in' | 'deseo_in' | 'accion_in' | 'cta_final' }> = [
  { node: 'bumper', label: 'Cortinilla (Bumper)', duration: 3, kf: 'bumper_start' },
  { node: 'atencion', label: 'Atención', duration: 4, kf: 'atencion_in' },
  { node: 'interes', label: 'Interés', duration: 6, kf: 'interes_in' },
  { node: 'deseo', label: 'Deseo', duration: 7, kf: 'deseo_in' },
  { node: 'accion', label: 'Acción', duration: 4, kf: 'accion_in' },
  { node: 'cta', label: 'CTA Final', duration: 3, kf: 'cta_final' },
];

export function MasterTab(): JSX.Element {
  const transitions = useProjectStore((s) => s.transitions);
  const keyframes = useProjectStore((s) => s.keyframes);
  const updateManifest = useProjectStore((s) => s.updateManifest);
  const masterVideo = useProjectStore((s) => s.masterVideo);
  const masterVideoUrl = useProjectStore((s) => s.masterVideoUrl);
  const manifest = useProjectStore((s) => s.manifest);
  const brief = useProjectStore((s) => s.brief);
  const addToast = useUIStore((s) => s.addToast);
  const [progress, setProgress] = useState<{ stage: string; pct: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [costModalOpen, setCostModalOpen] = useState(false);

  useJobProgress();

  const costInput = useMemo<CostEstimatorInput>(() => {
    const approved = Array.from(transitions.values()).filter((t) => t.status === 'approved');
    const kfNeedGen = Array.from(keyframes.values()).filter(
      (k) => k.source === 'generated_imagen3' && (k.status === 'empty' || k.status === 'uploaded'),
    );
    return {
      transitions: approved,
      keyframesNeedGeneration: kfNeedGen,
      voiceoverText: '',
      voiceoverDurationSec: 30,
      brief: brief ?? null,
    };
  }, [transitions, keyframes, brief]);

  const approvedCount = useMemo(
    () => Array.from(transitions.values()).filter((t) => t.status === 'approved').length,
    [transitions],
  );

  const handleGenerateBatch = useCallback((): void => {
    if (approvedCount === 0) {
      addToast({ kind: 'warning', message: 'Aprueba al menos un prompt antes de generar el lote.' });
      return;
    }
    setCostModalOpen(true);
  }, [approvedCount, addToast]);

  const handleConfirmBatch = useCallback(async (): Promise<void> => {
    setCostModalOpen(false);
    void requestNotificationPermission();
    const approved = Array.from(transitions.values()).filter((t) => t.status === 'approved');
    const specs: JobSpec[] = [];
    for (const t of approved) {
      const kfFrom = keyframes.get(t.fromKeyframe);
      const kfTo = keyframes.get(t.toKeyframe);
      if (!kfFrom || !kfTo) continue;
      specs.push({
        kind: 'video_generation',
        transitionId: t.id,
        transition: t,
        keyframeFrom: kfFrom,
        keyframeTo: kfTo,
        brief: brief ?? null,
      });
    }
    if (specs.length === 0) {
      addToast({ kind: 'warning', message: 'No hay transiciones con keyframes válidos.' });
      return;
    }
    try {
      await jobQueue.createBatch(specs);
      addToast({ kind: 'info', message: `Lote creado con ${specs.length} jobs.` });
    } catch (e) {
      addToast({ kind: 'error', message: `No se pudo crear el lote: ${(e as Error).message}` });
    }
  }, [transitions, keyframes, brief, addToast]);

  const handleAssemble = useCallback(async () => {
    if (!brief) {
      addToast({ kind: 'warning', message: 'Carga un brief primero.' });
      return;
    }
    setBusy(true);
    setProgress({ stage: 'Iniciando FFmpeg', pct: 0 });
    try {
      ffmpegService.onProgress = (p) => {
        setProgress({ stage: 'Procesando', pct: Math.max(0, Math.min(1, p.progress)) });
      };

      const blobs: { role: string; blob: Blob }[] = [];
      const timelineOrder: string[] = [];

      for (const node of NODE_ORDER) {
        const transition = Array.from(transitions.values()).find((t) => t.nodeKey === node.node);
        if (transition?.videoBlob) {
          blobs.push({ role: node.node, blob: transition.videoBlob });
          timelineOrder.push(node.node);
          continue;
        }
        const kf = keyframes.get(`kf_${node.kf}`);
        if (kf?.blob) {
          setProgress({ stage: `Generando placeholder ${node.label}`, pct: 0.3 });
          try {
            const staticVideo = await ffmpegService.staticVideoFromImage(kf.blob, node.duration);
            blobs.push({ role: node.node, blob: staticVideo });
            timelineOrder.push(node.node);
          } catch (err) {
            console.warn(`placeholder falló para ${node.node}`, err);
          }
        }
      }

      if (blobs.length === 0) {
        addToast({ kind: 'warning', message: 'Sube al menos una foto (keyframe) para generar el master.' });
        setBusy(false);
        setProgress(null);
        return;
      }

      setProgress({ stage: 'Concatenando con FFmpeg', pct: 0.6 });
      const master = await ffmpegService.smartConcat({ blobs, timelineOrder });
      const url = URL.createObjectURL(master);

      useProjectStore.setState((s) => ({
        ...s,
        masterVideo: master,
        masterVideoUrl: url,
      }));

      updateManifest();
      addToast({ kind: 'success', message: 'Master ensamblado.' });
      setProgress({ stage: 'Listo', pct: 1 });
    } catch (e) {
      const msg = (e as Error).message ?? 'Error desconocido';
      addToast({ kind: 'error', message: `FFmpeg falló: ${msg}` });
      useProjectStore.getState().setLastError(msg);
    } finally {
      ffmpegService.onProgress = null;
      setBusy(false);
      setTimeout(() => setProgress(null), 2500);
    }
  }, [transitions, keyframes, brief, addToast, updateManifest]);

  const handleGenerateVeo = useCallback(async () => {
    const approved = Array.from(transitions.values()).filter((t) => t.status === 'approved');
    if (approved.length === 0) {
      addToast({ kind: 'warning', message: 'Aprueba al menos un prompt antes de generar con Veo.' });
      return;
    }
    setBusy(true);
    try {
      for (const t of approved) {
        const fromKf = keyframes.get(t.fromKeyframe);
        const toKf = keyframes.get(t.toKeyframe);
        if (!fromKf || !toKf) continue;
        try {
          markTransitionStatus(t.id, 'generating');
          addToast({ kind: 'info', message: `Lanzando Veo para ${t.nodeKey} (2-5 min)...` });
          const { blob, url } = await generateTransition({ transition: t, fromKeyframe: fromKf, toKeyframe: toKf });
          storeClipAndMarkDone(t.id, blob, url);
          addToast({ kind: 'success', message: `Clip ${t.nodeKey} listo.` });
        } catch (e) {
          markTransitionFailed(t.id, (e as Error).message);
          addToast({ kind: 'error', message: `Veo falló en ${t.nodeKey}: ${(e as Error).message}` });
        }
      }
    } finally {
      setBusy(false);
    }
  }, [transitions, keyframes, addToast]);

  const handleDownloadMP4 = (): void => {
    if (!masterVideo) return;
    downloadBlob(masterVideo, `bridge-master-${Date.now()}.mp4`);
  };

  const handleDownloadManifest = (): void => {
    if (!manifest) return;
    downloadJSON({ ...manifest, briefSummary: brief?.business.name }, `bridge-manifest-${Date.now()}.json`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Button variant="success" size="lg" icon="fa-bolt" onClick={handleAssemble} loading={busy}>
          Ensamblar Master (FFmpeg)
        </Button>
        <Button variant="primary" size="lg" icon="fa-wand-magic-sparkles" onClick={handleGenerateVeo}>
          Generar clips aprobados con Veo
        </Button>
        <Button
          variant="primary"
          size="lg"
          icon="fa-film"
          onClick={handleGenerateBatch}
          disabled={approvedCount === 0}
        >
          Generar Lote Completo ({approvedCount} clips)
        </Button>
      </div>

      <JobsPanel />

      <CostEstimatorModal
        open={costModalOpen}
        onClose={() => setCostModalOpen(false)}
        onConfirm={handleConfirmBatch}
        input={costInput}
      />

      {progress && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
          <div className="flex items-center justify-between gap-2">
            <span>{progress.stage}</span>
            <span>{Math.round(progress.pct * 100)}%</span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-800 rounded overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${Math.round(progress.pct * 100)}%` }}
            />
          </div>
        </div>
      )}

      {masterVideo && masterVideoUrl ? (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <video src={masterVideoUrl} controls className="w-full max-h-[480px] rounded-lg bg-black" />
          <div className="flex flex-wrap items-center gap-3 justify-between text-xs text-slate-400">
            <span>Tamaño: {formatBytes(masterVideo.size)}</span>
            <span>Master 9:16 · H.264 · AAC</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="fa-download" onClick={handleDownloadMP4}>
              Descargar master.mp4
            </Button>
            <Button variant="secondary" icon="fa-file-code" onClick={handleDownloadManifest}>
              Descargar manifest.json
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
          Aún no hay master. Sube fotos y aprueba al menos un prompt para generar.
        </div>
      )}

      <div className="text-[11px] text-slate-500 border-t border-slate-800 pt-3">
        <i className="fa-solid fa-circle-info mr-1" />
        Si no hay clips Veo todavía, el ensamblador genera placeholders con tus fotos + duraciones fijas.
      </div>
    </div>
  );
}
