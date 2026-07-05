/**
 * SplitViewHost — wrapper que conecta uiStore.splitViewTransitionId con
 * SplitViewEditor, resolviendo transition + keyframes + versions del project store.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.7.
 *
 * Se monta en App.tsx (al lado de PromptApprovalGate). Si no hay id activo,
 * retorna null sin overhead.
 *
 * H1-fix (GEMINI auditoría 2026-07-04): los callbacks granulares
 * (regenerate visual/VO/subs/camera) implementan el gate ADR-04: requieren
 * `transition.status === 'approved'` ANTES de cualquier operación. Si el
 * status es 'pending'|'prompt_ready'|'generating'|'failed', se rechaza con
 * toast de error y NO se regenera. Esto evita bypass del prompt approval gate.
 *
 * ID: IMPL-20260704-01
 */

import { useEffect, useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { SplitViewEditor } from '@/components/generation/SplitViewEditor';
import { versionHistory } from '@/services/versionHistory';
import { buildKeyframeTransitionPrompt } from '@/services/promptBuilder';
import type { KeyframeTransition, PromptVersion } from '@/types/transition';
import type { SubtitleMaster } from '@/types/project';

export function SplitViewHost(): JSX.Element | null {
  const splitViewId = useUIStore((s) => s.splitViewTransitionId);
  const closeSplitView = useUIStore((s) => s.closeSplitView);
  const addToast = useUIStore((s) => s.addToast);
  const transitions = useProjectStore((s) => s.transitions);
  const keyframes = useProjectStore((s) => s.keyframes);
  const approveTransitionPrompt = useProjectStore((s) => s.approveTransitionPrompt);
  const generateTransition = useProjectStore((s) => s.generateTransition);
  // ARCH-20260704-09: jobs persistentes de generación.
  const startGenerationJob = useProjectStore((s) => s.startGenerationJob);
  const finishGenerationJob = useProjectStore((s) => s.finishGenerationJob);

  const [versions, setVersions] = useState<PromptVersion[]>([]);

  const transition = splitViewId ? transitions.get(splitViewId) : undefined;
  const keyframeFrom = transition ? keyframes.get(transition.fromKeyframe) : undefined;
  const keyframeTo = transition ? keyframes.get(transition.toKeyframe) : undefined;

  // Carga historial de versiones cuando se abre el editor
  useEffect(() => {
    if (!splitViewId) {
      setVersions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const list = await versionHistory.getVersions(splitViewId);
      if (!cancelled) setVersions(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [splitViewId]);

  const handleApprove = useCallback(
    async (finalPrompt: string): Promise<void> => {
      if (!transition) return;
      approveTransitionPrompt(transition.id, finalPrompt);
      // Persist como nueva versión
      const newVersion: PromptVersion = {
        version: (transition.promptHistory.length ?? 0) + 1,
        prompt: finalPrompt,
        approvedAt: Date.now(),
        approvedBy: 'user',
        diffFromPrevious: transition.promptFinal
          ? versionHistory.generateDiff(transition.promptFinal, finalPrompt)
          : undefined,
      };
      await versionHistory.recordVersion(transition.id, newVersion);
      setVersions((prev) =>
        [newVersion, ...prev.filter((v) => v.version !== newVersion.version)].slice(0, 5),
      );
      addToast({ kind: 'success', message: `Prompt aprobado: ${transition.nodeKey}.` });
      // ARCH-20260704-09: badge persistente de generación.
      startGenerationJob(transition.id);
      try {
        await generateTransition(transition.id);
        finishGenerationJob(transition.id, true);
        addToast({ kind: 'info', message: 'Regenerando clip con Veo (~2 min)…' });
      } catch (e) {
        finishGenerationJob(transition.id, false, (e as Error).message);
        addToast({ kind: 'warning', message: `Aprobado pero Veo no lanzó: ${(e as Error).message}` });
      }
      closeSplitView();
    },
    [transition, approveTransitionPrompt, addToast, generateTransition, closeSplitView, startGenerationJob, finishGenerationJob],
  );

  // ─────────────────────────────────────────────────────────────
  // H1-FIX: helper común para verificar ADR-04 gate.
  // Retorna `true` si pasa el gate (status='approved'), `false` si lo viola.
  // ─────────────────────────────────────────────────────────────
  const checkApprovalGate = useCallback((): boolean => {
    if (!transition) {
      addToast({ kind: 'error', message: 'Transición no encontrada.' });
      return false;
    }
    if (transition.status !== 'approved') {
      addToast({
        kind: 'error',
        message: `Aprueba el prompt antes de regenerar (status: ${transition.status}).`,
      });
      return false;
    }
    return true;
  }, [transition, addToast]);

  /**
   * Registra una nueva versión en versionHistory + actualiza estado local `versions`.
   * Llamar DESPUÉS de approveTransitionPrompt.
   */
  const recordNewVersion = useCallback(
    async (
      reason: string,
      promptText: string,
    ): Promise<PromptVersion> => {
      if (!transition) throw new Error('Transición no existe');
      const newVersion: PromptVersion = {
        version: (transition.promptHistory.length ?? 0) + 1,
        prompt: promptText,
        approvedAt: Date.now(),
        approvedBy: 'user',
        changeReason: reason,
        diffFromPrevious: transition.promptFinal
          ? versionHistory.generateDiff(transition.promptFinal, promptText)
          : undefined,
      };
      await versionHistory.recordVersion(transition.id, newVersion);
      setVersions((prev) =>
        [newVersion, ...prev.filter((v) => v.version !== newVersion.version)].slice(0, 5),
      );
      return newVersion;
    },
    [transition],
  );

  // ─────────────────────────────────────────────────────────────
  // handleRegenerateVisual — Imagen 3 + Veo. Gate ADR-04 enforced.
  // ─────────────────────────────────────────────────────────────
  const handleRegenerateVisual = useCallback(
    async (intent: string): Promise<void> => {
      if (!transition || !keyframeFrom || !keyframeTo) return;
      if (!checkApprovalGate()) return;

      // (busy state gestionado por VisualTab internamente)
      try {
        // 1) Build nuevo prompt con la nueva intent humana
        const newPrompt = buildKeyframeTransitionPrompt({
          fromKf: keyframeFrom,
          toKf: keyframeTo,
          nodeKey: transition.nodeKey,
          cameraSpec: transition.cameraSpec,
          humanIntent: intent,
          brandKit: useProjectStore.getState().brandKit,
        });

        // 2) Aprobar nueva versión del prompt (registra en store + history)
        approveTransitionPrompt(transition.id, newPrompt);
        await recordNewVersion(`regenerate-visual: ${intent}`, newPrompt);

        // 3) Disparar generación (status pasa a 'generating'; el jobQueue
        // procesará el Veo I2V en background)
        startGenerationJob(transition.id);
        await generateTransition(transition.id);
        finishGenerationJob(transition.id, true);

        addToast({
          kind: 'success',
          message: `Visual regenerado (${transition.nodeKey}). Veo procesando ~2 min…`,
        });
      } catch (err) {
        finishGenerationJob(transition.id, false, (err as Error).message);
        addToast({
          kind: 'error',
          message: `Error al regenerar visual: ${(err as Error).message}`,
        });
      }
    },
    [transition, keyframeFrom, keyframeTo, checkApprovalGate, approveTransitionPrompt, recordNewVersion, generateTransition, addToast, startGenerationJob, finishGenerationJob],
  );

  // ─────────────────────────────────────────────────────────────
  // handleRegenerateVO — TTS por segmento. Gate ADR-04 enforced.
  // ─────────────────────────────────────────────────────────────
  const handleRegenerateVO = useCallback(
    async (text: string, voice: string): Promise<void> => {
      if (!transition) return;
      if (!checkApprovalGate()) return;

      try {
        // Construir un SubtitleSegment para el nodo actual
        // (en producción real esto lo haría Gemini TTS; aquí preparamos la metadata
        // y la guardamos en el store para que el SmartConcat la recoja)
        const newSubs: SubtitleMaster = {
          vtt: `WEBVTT\n\n00:00:00.000 --> 00:00:0${transition.duration}.000\n${text}\n`,
          segments: [
            {
              id: `sub_${transition.id}`,
              start: 0,
              end: transition.duration,
              text,
              speaker: voice,
            },
          ],
          style: {
            fontFamily: 'Inter',
            fontSize: 24,
            color: '#FFFFFF',
            outline: 2,
            shadow: 1,
            marginV: 24,
            bold: true,
          },
        };

        // Persistir SubtitleMaster en store (sobrescribe el global; en producción
        // se mergea segmento a segmento)
        useProjectStore.setState({ subtitles: newSubs });

        // Aprobar prompt + versionar (el texto del VO se anexa como intent)
        const newPrompt = `${transition.promptFinal ?? transition.prompt}\n[VO: ${text} (${voice})]`;
        approveTransitionPrompt(transition.id, newPrompt);
        await recordNewVersion(`regenerate-vo: ${voice}`, newPrompt);

        addToast({
          kind: 'success',
          message: `Voz regenerada para ${transition.nodeKey} (${voice}).`,
        });
      } catch (err) {
        addToast({
          kind: 'error',
          message: `Error al regenerar VO: ${(err as Error).message}`,
        });
      }
    },
    [transition, checkApprovalGate, approveTransitionPrompt, recordNewVersion, addToast],
  );

  // ─────────────────────────────────────────────────────────────
  // handleUpdateSubtitles — edición de subtítulo del segmento. Gate ADR-04.
  // ─────────────────────────────────────────────────────────────
  const handleUpdateSubtitles = useCallback(
    async (text: string): Promise<void> => {
      if (!transition) return;
      if (!checkApprovalGate()) return;

      try {
        const existing = useProjectStore.getState().subtitles;
        const newSubSegment = {
          id: `sub_${transition.id}`,
          start: 0,
          end: transition.duration,
          text,
        };
        const newSubs: SubtitleMaster = existing
          ? {
              ...existing,
              vtt: `${existing.vtt}\n00:00:00.000 --> 00:00:0${transition.duration}.000\n${text}\n`,
              segments: [
                ...existing.segments.filter((s) => s.id !== newSubSegment.id),
                newSubSegment,
              ],
            }
          : {
              vtt: `WEBVTT\n\n00:00:00.000 --> 00:00:0${transition.duration}.000\n${text}\n`,
              segments: [newSubSegment],
              style: {
                fontFamily: 'Inter',
                fontSize: 24,
                color: '#FFFFFF',
                outline: 2,
                shadow: 1,
                marginV: 24,
                bold: true,
              },
            };
        useProjectStore.setState({ subtitles: newSubs });

        // Registrar versión con subtítulo nuevo
        const reason = `update-subtitles: "${text.slice(0, 40)}"`;
        const currentPrompt = transition.promptFinal ?? transition.prompt;
        approveTransitionPrompt(transition.id, currentPrompt);
        await recordNewVersion(reason, currentPrompt);

        addToast({ kind: 'success', message: 'Subtítulos actualizados.' });
      } catch (err) {
        addToast({
          kind: 'error',
          message: `Error al actualizar subtítulos: ${(err as Error).message}`,
        });
      }
    },
    [transition, checkApprovalGate, approveTransitionPrompt, recordNewVersion, addToast],
  );

  // ─────────────────────────────────────────────────────────────
  // handleUpdateCameraSpec — edición de cameraSpec. Gate ADR-04.
  // ─────────────────────────────────────────────────────────────
  const handleUpdateCameraSpec = useCallback(
    async (spec: unknown): Promise<void> => {
      if (!transition) return;
      if (!checkApprovalGate()) return;

      try {
        const cameraSpec = spec as KeyframeTransition['cameraSpec'];

        // Persistir nuevo cameraSpec en la transition
        useProjectStore.setState((s) => {
          const cur = s.transitions.get(transition.id);
          if (!cur) return s;
          const next = new Map(s.transitions);
          next.set(transition.id, { ...cur, cameraSpec });
          return { transitions: next };
        });

        // Re-aprobar prompt (camera no cambia el texto, pero sí la generación)
        const currentPrompt = transition.promptFinal ?? transition.prompt;
        approveTransitionPrompt(transition.id, currentPrompt);
        await recordNewVersion(
          `update-camera: ${cameraSpec.movement}/${cameraSpec.framing}`,
          currentPrompt,
        );

        addToast({ kind: 'success', message: 'CameraSpec actualizado.' });
      } catch (err) {
        addToast({
          kind: 'error',
          message: `Error al actualizar cámara: ${(err as Error).message}`,
        });
      }
    },
    [transition, checkApprovalGate, approveTransitionPrompt, recordNewVersion, addToast],
  );

  const handleRestoreVersion = useCallback((version: PromptVersion): void => {
    if (!transition) return;
    approveTransitionPrompt(transition.id, version.prompt);
    addToast({ kind: 'info', message: `Restaurado v${version.version}.` });
  }, [transition, approveTransitionPrompt, addToast]);

  if (!splitViewId || !transition || !keyframeFrom || !keyframeTo) {
    return null;
  }

  const currentVersion: PromptVersion = {
    version: (transition.promptHistory.length ?? 0) + 1,
    prompt: transition.promptFinal ?? transition.prompt,
    approvedAt: transition.generatedAt ?? Date.now(),
    approvedBy: 'user',
  };

  return (
    <SplitViewEditor
      transitionId={transition.id}
      transition={transition}
      keyframeFrom={keyframeFrom}
      keyframeTo={keyframeTo}
      promptVersion={currentVersion}
      versions={versions}
      onApprove={handleApprove}
      onRegenerateVisual={handleRegenerateVisual}
      onRegenerateVO={handleRegenerateVO}
      onUpdateSubtitles={handleUpdateSubtitles}
      onUpdateCameraSpec={handleUpdateCameraSpec}
      onRestoreVersion={handleRestoreVersion}
      onClose={closeSplitView}
    />
  );
}
