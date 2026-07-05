/**
 * projectStore — corazón del estado persistente.
 * Persiste brief, keyframes, transitions, clips y manifest en IndexedDB.
 * Spec: SPEC-S1-FOUNDATION §1.4 + ARCH-20260703-01 §5.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectState, ManifestEntry } from '@/types/project';
import type { MasterBrief, BusinessIdentity, ServiceToAdvertise, GlobalAdVision, AidaStageKey } from '@/types/brief';
import type { Keyframe, KeyframeRole, CameraSpec } from '@/types/keyframe';
import { STORYBOARD_SLOTS } from '@/types/keyframe';
import type { KeyframeTransition, AidaNodeKey, PromptVersion } from '@/types/transition';
import { TRANSITION_DURATIONS } from '@/types/transition';
import type { AnalysisJob, GenerationJob } from '@/types/progressJobs';
import { idbStorage, blobToBase64, base64ToBlob } from './idbStorage';
import { generateTransitionWithRetry } from '@/services/gemini/video';

const PROJECT_STORE_VERSION = 1;
const DEFAULT_CAMERA: CameraSpec = {
  movement: 'smooth dolly in',
  framing: 'medium close-up',
  angle: 'eye level',
  speed: 'medium',
};
const ORDERED_SLOTS = STORYBOARD_SLOTS.map((s) => s.role);

function buildInitialKeyframes(): { keyframes: Map<string, Keyframe>; orderedKeyframes: string[] } {
  const entries: Array<[string, Keyframe]> = STORYBOARD_SLOTS.map((slot, idx) => {
    const id = `kf_${slot.role}`;
    const kf: Keyframe = {
      id,
      role: slot.role,
      label: slot.label,
      description: slot.description,
      source: 'user_upload',
      timestamp: idx * 4,
      status: 'empty',
    };
    return [id, kf];
  });
  return {
    keyframes: new Map(entries),
    orderedKeyframes: ORDERED_SLOTS.map((role) => `kf_${role}`),
  };
}

const NODE_PAIR_ORDER: Array<{ from: string; to: string; node: AidaNodeKey }> = [
  { from: 'kf_bumper_start', to: 'kf_atencion_in', node: 'bumper' },
  { from: 'kf_atencion_in', to: 'kf_interes_in', node: 'atencion' },
  { from: 'kf_interes_in', to: 'kf_deseo_in', node: 'interes' },
  { from: 'kf_deseo_in', to: 'kf_accion_in', node: 'deseo' },
  { from: 'kf_accion_in', to: 'kf_cta_final', node: 'accion' },
];

function buildInitialTransitions(): Map<string, KeyframeTransition> {
  const t = new Map<string, KeyframeTransition>();
  for (const pair of NODE_PAIR_ORDER) {
    const id = `trans_${pair.node}`;
    const initial: KeyframeTransition = {
      id,
      fromKeyframe: pair.from,
      toKeyframe: pair.to,
      nodeKey: pair.node,
      duration: TRANSITION_DURATIONS[pair.node],
      prompt: '',
      cameraSpec: { ...DEFAULT_CAMERA },
      status: 'pending',
      promptHistory: [],
    };
    t.set(id, initial);
  }
  return t;
}

const initialKf = buildInitialKeyframes();
const initialTrans = buildInitialTransitions();

interface PersistedShape {
  brief: MasterBrief | null;
  executableProject: unknown;
  brandKit: unknown;
  globalStylePrompt: string;
  kfArr: Array<[string, Keyframe]>;
  trArr: Array<[string, KeyframeTransition]>;
  clipArr: Array<[string, string]>;
  manifest: ManifestEntry | null;
  version: number;
}

function mapsToArrays(state: Pick<ProjectState, 'keyframes' | 'transitions' | 'clips'>): {
  kfArr: Array<[string, Keyframe]>;
  trArr: Array<[string, KeyframeTransition]>;
  clipArr: Array<[string, string]>;
} {
  const kfArr: Array<[string, Keyframe]> = [];
  state.keyframes.forEach((v, k) => {
    kfArr.push([k, { ...v, blob: undefined }]);
  });
  const trArr: Array<[string, KeyframeTransition]> = [];
  state.transitions.forEach((v, k) => {
    trArr.push([k, { ...v, videoBlob: undefined }]);
  });
  const clipArr: Array<[string, string]> = [];
  state.clips.forEach((v, k) => {
    try {
      clipArr.push([k, URL.createObjectURL(v)]);
    } catch {
      // ignore
    }
  });
  return { kfArr, trArr, clipArr };
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      brief: null,
      executableProject: null,
      brandKit: null,
      globalStylePrompt: '',

      keyframes: initialKf.keyframes,
      transitions: initialTrans,
      orderedKeyframes: initialKf.orderedKeyframes,

      clips: new Map(),
      voiceover: null,
      subtitles: null,
      masterVideo: null,
      masterVideoUrl: null,
      exportPack: null,
      manifest: null,

      activeTransitionId: null,
      promptGateOpen: false,
      lastError: null,

      analysisJobs: new Map<string, AnalysisJob>(),
      generationJobs: new Map<string, GenerationJob>(),

      loadBrief: (brief) => {
        const brandKit = get().brandKit ?? {
          brandName: brief.business.name,
          acronym: brief.business.acronym,
          slogan: brief.business.slogan,
          palette: { primary: '#0ea5e9', secondary: '#22c55e', accent: '#d946ef', bg: '#0b0f19', fg: '#f8fafc' },
          fonts: { heading: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans', mono: 'JetBrains Mono' },
          tone: brief.globalVision.toneKeywords,
        };
        set({
          brief,
          brandKit,
          globalStylePrompt: buildGlobalStylePrompt(brief),
        });
        // S6: Analytics opt-in (GDPR-safe). Sin PII — solo sector + count.
        // Importación diferida para no introducir ciclo si analytics importa projectStore.
        import('@/services/analytics').then(({ analytics }) => {
          analytics.record({
            type: 'brief_completed',
            sector: brief.business.sector,
            servicesCount: brief.services.length,
            timestamp: Date.now(),
          });
        }).catch(() => undefined);
      },

      resetProject: () => {
        const kfInit = buildInitialKeyframes();
        set({
          brief: null,
          executableProject: null,
          brandKit: null,
          globalStylePrompt: '',
          keyframes: kfInit.keyframes,
          transitions: buildInitialTransitions(),
          orderedKeyframes: kfInit.orderedKeyframes,
          clips: new Map(),
          voiceover: null,
          subtitles: null,
          masterVideo: null,
          masterVideoUrl: null,
          exportPack: null,
          manifest: null,
          activeTransitionId: null,
          promptGateOpen: false,
          lastError: null,
          analysisJobs: new Map(),
          generationJobs: new Map(),
        });
      },

      updateBusiness: (partial: Partial<BusinessIdentity>) =>
        set((s) => {
          if (!s.brief) return s;
          return {
            brief: {
              ...s.brief,
              business: { ...s.brief.business, ...partial },
              updatedAt: Date.now(),
            },
          };
        }),

      addService: () => {
        const newService: ServiceToAdvertise = {
          id: `svc_${uuidv4().slice(0, 8)}`,
          name: 'Nuevo servicio',
          description: '',
          keyBenefit: '',
          stages: { attention: '', interest: '', desire: '', action: '' },
        };
        set((s) => {
          if (!s.brief) return s;
          return {
            brief: {
              ...s.brief,
              services: [...s.brief.services, newService],
              updatedAt: Date.now(),
            },
          };
        });
        return newService;
      },

      updateService: (serviceId: string, partial: Partial<ServiceToAdvertise>) =>
        set((s) => {
          if (!s.brief) return s;
          const idx = s.brief.services.findIndex((sv) => sv.id === serviceId);
          if (idx < 0) return s;
          const next = [...s.brief.services];
          next[idx] = { ...next[idx], ...partial };
          return { brief: { ...s.brief, services: next, updatedAt: Date.now() } };
        }),

      removeService: (serviceId: string) =>
        set((s) => {
          if (!s.brief) return s;
          return {
            brief: {
              ...s.brief,
              services: s.brief.services.filter((sv) => sv.id !== serviceId),
              updatedAt: Date.now(),
            },
          };
        }),

      updateServiceStage: (serviceId: string, stage: AidaStageKey, description: string) =>
        set((s) => {
          if (!s.brief) return s;
          const next = s.brief.services.map((sv) =>
            sv.id === serviceId
              ? { ...sv, stages: { ...sv.stages, [stage]: description } }
              : sv,
          );
          return { brief: { ...s.brief, services: next, updatedAt: Date.now() } };
        }),

      setGlobalVision: (partial: Partial<GlobalAdVision>) =>
        set((s) => {
          if (!s.brief) return s;
          return {
            brief: {
              ...s.brief,
              globalVision: { ...s.brief.globalVision, ...partial },
              updatedAt: Date.now(),
            },
          };
        }),

      setKeyframe: (kf: Keyframe) =>
        set((s) => {
          const next = new Map(s.keyframes);
          next.set(kf.id, kf);
          return { keyframes: next };
        }),

      uploadKeyframeImage: async (role: KeyframeRole, file: File, isReuploadOverride?: boolean) => {
        const id = `kf_${role}`;
        const base64 = await blobToBase64(file);
        set((s) => {
          const existing = s.keyframes.get(id);
          if (!existing) return s;
          // ARCH-20260704-07 + ARCH-20260704-08: si el keyframe ya tenía
          // contenido previo (reupload), resetear COMPLETAMENTE el keyframe y
          // TODAS las transiciones que apuntan a él. Si NO se resetea, el
          // botón "Generar clip" desaparece porque canGenerateClip exige
          // outgoing.status === 'pending'.
          //
          // El caller puede pasar `isReuploadOverride` para forzar el flag
          // (útil cuando necesita calcularlo leyendo el estado ANTES de
          // invocar upload). Si no se pasa, se autodetecta por status.
          const isReupload = isReuploadOverride ?? existing.status !== 'empty';
          const resetKf: Keyframe = isReupload
            ? {
                ...existing,
                blob: file,
                base64,
                mimeType: file.type,
                source: 'user_upload',
                status: 'uploaded',
                error: undefined,
                visualAnalysis: undefined,
                humanIntent: '',
                humanDescription: '',
                // ARCH-20260704-08 (fix GEMINI): generationPrompt puede contener
                // un prompt derivado del visualAnalysis viejo; al reupload debe
                // quedar limpio para que el próximo análisis regenere desde cero.
                generationPrompt: undefined,
              }
            : {
                ...existing,
                blob: file,
                base64,
                mimeType: file.type,
                source: 'user_upload',
                status: 'uploaded',
                error: undefined,
              };
          const next = new Map(s.keyframes);
          next.set(id, resetKf);

          // Si es reupload, resetear TODAS las transiciones que tocan este
          // keyframe (tanto salientes como entrantes) para que vuelvan a
          // aparecer los botones "Generar clip" y "Aprobar prompt".
          // ARCH-20260704-08 (fix GEMINI): reset COMPLETO — además del prompt,
          // se limpian los blobs/urls de video, el operation id de Veo y el
          // historial de prompts para que no quede estado residual que
          // contamine la siguiente generación.
          let nextTransitions = s.transitions;
          if (isReupload) {
            nextTransitions = new Map(s.transitions);
            for (const [tId, t] of s.transitions) {
              if (t.fromKeyframe === id || t.toKeyframe === id) {
                nextTransitions.set(tId, {
                  ...t,
                  status: 'pending',
                  prompt: '',
                  promptFinal: undefined,
                  errorMessage: undefined,
                  videoBlob: undefined,
                  videoUrl: undefined,
                  veoOperationId: undefined,
                  generatedAt: undefined,
                  promptHistory: [],
                });
              }
            }
          }

          return { keyframes: next, transitions: nextTransitions };
        });
      },

      analyzeKeyframe: async (keyframeId: string) => {
        const kf = get().keyframes.get(keyframeId);
        if (!kf || !kf.base64) throw new Error('Keyframe sin imagen');
        set((s) => {
          const cur = s.keyframes.get(keyframeId);
          if (!cur) return s;
          const next = new Map(s.keyframes);
          next.set(keyframeId, { ...cur, status: 'analyzed' });
          return { keyframes: next };
        });
      },

      setKeyframeIntent: (keyframeId: string, intent: string, description?: string) =>
        set((s) => {
          const cur = s.keyframes.get(keyframeId);
          if (!cur) return s;
          const next = new Map(s.keyframes);
          next.set(keyframeId, {
            ...cur,
            humanIntent: intent,
            ...(description !== undefined ? { humanDescription: description } : {}),
          });
          return { keyframes: next };
        }),

      approveKeyframe: (keyframeId: string) =>
        set((s) => {
          const cur = s.keyframes.get(keyframeId);
          if (!cur) return s;
          const next = new Map(s.keyframes);
          next.set(keyframeId, { ...cur, status: 'approved' });
          return { keyframes: next };
        }),

      generateMissingKeyframes: async () => {
        set((s) => {
          const next = new Map(s.keyframes);
          const outRoles: Array<'atencion_out' | 'interes_out' | 'deseo_out'> = ['atencion_out', 'interes_out', 'deseo_out'];
          for (const role of outRoles) {
            const cur = next.get(`kf_${role}`);
            if (cur && cur.status === 'empty') {
              next.set(`kf_${role}`, { ...cur, status: 'analyzed' });
            }
          }
          return { keyframes: next };
        });
      },

      buildTransition: (fromKfId: string, toKfId: string, nodeKey: AidaNodeKey): KeyframeTransition | null => {
        const id = `trans_${nodeKey}`;
        const existing = get().transitions.get(id);
        if (existing) return existing;
        const transition: KeyframeTransition = {
          id,
          fromKeyframe: fromKfId,
          toKeyframe: toKfId,
          nodeKey,
          duration: TRANSITION_DURATIONS[nodeKey],
          prompt: '',
          cameraSpec: { ...DEFAULT_CAMERA },
          status: 'pending',
          promptHistory: [],
        };
        set((s) => {
          const next = new Map(s.transitions);
          next.set(id, transition);
          return { transitions: next };
        });
        return transition;
      },

      approveTransitionPrompt: (transitionId: string, finalPrompt: string) =>
        set((s) => {
          const cur = s.transitions.get(transitionId);
          if (!cur) return s;
          const version: PromptVersion = {
            version: cur.promptHistory.length + 1,
            prompt: finalPrompt,
            approvedAt: Date.now(),
            approvedBy: 'user',
          };
          const next = new Map(s.transitions);
          next.set(transitionId, {
            ...cur,
            promptFinal: finalPrompt,
            promptHistory: [...cur.promptHistory, version],
            status: 'approved',
          });
          return { transitions: next };
        }),

      // ARCH-20260704-10: generateTransition ahora invoca la generación real
      // de Veo vía generateTransitionWithRetry (con 5 reintentos y backoff
      // exponencial). El flujo anterior era un stub S1 que solo seteaba
      // status='generating' y terminaba.
      //
      // Decisión de diseño: usamos `generateTransitionWithRetry` directamente
      // (no `jobQueue.createBatch`) porque:
      //   1. Mantiene el contrato simple (Promise<void> en éxito, throw en fallo).
      //   2. PromptApprovalGate ya gestiona los badges persistentes vía
      //      `startGenerationJob` / `finishGenerationJob` antes/después del await.
      //   3. Evita acoplar este flujo a la cola persistente (que ya tiene su
      //      propio flujo en MasterTab.handleConfirmBatch para lotes grandes).
      //
      // Snapshots: capturamos copies de transition + keyframes al inicio para
      // evitar race conditions si el usuario reuploada una imagen mientras
      // Veo está trabajando (el reset del keyframe limpia la transición).
      generateTransition: async (transitionId: string) => {
        const transition = get().transitions.get(transitionId);
        if (!transition) throw new Error('Transición no existe');
        if (transition.status !== 'approved') {
          throw new Error('La transición requiere prompt aprobado antes de generar');
        }
        const fromKf = get().keyframes.get(transition.fromKeyframe);
        const toKf = get().keyframes.get(transition.toKeyframe);
        if (!fromKf || !toKf) {
          throw new Error('Faltan keyframes para la transición');
        }

        // Snapshot inmutable para evitar race conditions si el usuario
        // reuploada una imagen mientras Veo está procesando.
        const transitionSnapshot = { ...transition };
        const fromKfSnapshot = { ...fromKf };
        const toKfSnapshot = { ...toKf };

        // Feedback UI inmediato: status pasa a 'generating' antes del await
        // para que el badge "Generando clip con Veo 3.1… ~Xs" se active.
        set((s) => {
          const cur = s.transitions.get(transitionId);
          if (!cur) return s;
          const next = new Map(s.transitions);
          next.set(transitionId, { ...cur, status: 'generating' });
          return { transitions: next };
        });

        try {
          const result = await generateTransitionWithRetry(
            transitionSnapshot,
            fromKfSnapshot,
            toKfSnapshot,
          );

          // Éxito: persistir el resultado en la transición + clips map.
          // ARCH-20260704-10 (race-condition guard): si el usuario re-subió la imagen
          // mientras Veo trabajaba (1-5 min), el store ya reseteó esta transición a
          // 'pending' o 'uploaded'. Si aplicamos el resultado viejo, el video generado
          // desde la imagen anterior aparecería como "done" con un blob obsoleto que
          // NO corresponde al keyframe actual. Guard: solo persistir si el status
          // sigue siendo 'generating'.
          set((s) => {
            const cur = s.transitions.get(transitionId);
            if (!cur) return s;
            if (cur.status !== 'generating') {
              // Stale: el usuario reemplazó la imagen o aprobó otra transición.
              // Descartar el blob para no cobrar memoria ni confundir la UI.
              if (typeof result?.url === 'string' && result.url.startsWith('blob:')) {
                URL.revokeObjectURL(result.url);
              }
              return s;
            }
            const nextTrans = new Map(s.transitions);
            nextTrans.set(transitionId, {
              ...cur,
              status: 'done',
              videoBlob: result.blob,
              videoUrl: result.url,
              veoOperationId: result.operationId,
              generatedAt: Date.now(),
              errorMessage: undefined,
            });
            const nextClips = new Map(s.clips);
            nextClips.set(transitionId, result.blob);
            return { transitions: nextTrans, clips: nextClips };
          });
        } catch (err) {
          const errorMessage = (err as Error).message ?? 'Error desconocido';
          set((s) => {
            const cur = s.transitions.get(transitionId);
            if (!cur) return s;
            const next = new Map(s.transitions);
            next.set(transitionId, {
              ...cur,
              status: 'failed',
              errorMessage,
            });
            return { transitions: next };
          });
          throw err;
        }
      },

      regenerateTransition: async (transitionId: string) =>
        set((s) => {
          const cur = s.transitions.get(transitionId);
          if (!cur) return s;
          const next = new Map(s.transitions);
          next.set(transitionId, { ...cur, status: 'prompt_ready' });
          return { transitions: next };
        }),

      openPromptGate: (transitionId: string) => set({ activeTransitionId: transitionId, promptGateOpen: true }),
      closePromptGate: () => set({ promptGateOpen: false, activeTransitionId: null }),
      setActiveTransition: (id: string | null) => set({ activeTransitionId: id }),
      setLastError: (msg: string | null) => set({ lastError: msg }),

      assembleMaster: async () => {
        set({ lastError: 'Master no ensamblado todavía — implementar FFmpeg worker.' });
      },

      updateManifest: () => {
        const state = get();
        const manifest: ManifestEntry = {
          timelineOrder: Array.from(state.transitions.values()).map((t: KeyframeTransition) => t.nodeKey),
          clips: Array.from(state.transitions.values()).map((t: KeyframeTransition) => ({
            transitionId: t.id,
            nodeKey: t.nodeKey,
            duration: t.duration,
            promptApproved: t.promptFinal ?? '',
            promptOriginal: t.prompt,
            fromKeyframeId: t.fromKeyframe,
            toKeyframeId: t.toKeyframe,
            generatedAt: t.generatedAt,
          })),
          brandKit: state.brandKit ?? undefined,
          generatedAt: Date.now(),
          appVersion: '0.1.0',
        };
        set({ manifest });
      },

      // ARCH-20260704-09: badges de progreso persistentes.
      startAnalysisJob: (keyframeId: string) =>
        set((s) => {
          const next = new Map(s.analysisJobs);
          next.set(keyframeId, { keyframeId, state: 'analyzing', startedAt: Date.now() });
          return { analysisJobs: next };
        }),

      finishAnalysisJob: (keyframeId: string, ok: boolean, errorMessage?: string) =>
        set((s) => {
          const cur = s.analysisJobs.get(keyframeId);
          const next = new Map(s.analysisJobs);
          next.set(keyframeId, {
            keyframeId,
            state: ok ? 'done' : 'failed',
            startedAt: cur?.startedAt,
            finishedAt: Date.now(),
            errorMessage,
          });
          return { analysisJobs: next };
        }),

      startGenerationJob: (transitionId: string) =>
        set((s) => {
          const next = new Map(s.generationJobs);
          next.set(transitionId, { transitionId, state: 'generating', startedAt: Date.now() });
          return { generationJobs: next };
        }),

      finishGenerationJob: (transitionId: string, ok: boolean, errorMessage?: string, attempts?: number) =>
        set((s) => {
          const cur = s.generationJobs.get(transitionId);
          const next = new Map(s.generationJobs);
          next.set(transitionId, {
            transitionId,
            state: ok ? 'done' : 'failed',
            startedAt: cur?.startedAt,
            finishedAt: Date.now(),
            attempts,
            errorMessage,
          });
          return { generationJobs: next };
        }),
    }),
    {
      name: 'bridge-project',
      version: PROJECT_STORE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state): PersistedShape => {
        const { kfArr, trArr, clipArr } = mapsToArrays(state);
        // ARCH-20260704-09: analysisJobs y generationJobs son EFÍMEROS.
        // partialize es allow-list → NO se incluyen en IDB. Si alguna vez se
        // migra a omit-list, agregar ambas keys explícitamente.
        return {
          brief: state.brief,
          executableProject: state.executableProject,
          brandKit: state.brandKit,
          globalStylePrompt: state.globalStylePrompt,
          kfArr,
          trArr,
          clipArr,
          manifest: state.manifest,
          version: PROJECT_STORE_VERSION,
        };
      },
      merge: (persistedState, currentState): ProjectState => {
        const persisted = (persistedState ?? {}) as Partial<PersistedShape>;
        const keyframes = new Map<string, Keyframe>(currentState.keyframes);
        (persisted.kfArr ?? []).forEach(([k, v]) => {
          const cur = keyframes.get(k);
          keyframes.set(k, { ...v, blob: cur?.blob });
        });
        const transitions = new Map<string, KeyframeTransition>(currentState.transitions);
        (persisted.trArr ?? []).forEach(([k, v]) => {
          const cur = transitions.get(k);
          transitions.set(k, { ...v, videoBlob: cur?.videoBlob, videoUrl: cur?.videoUrl });
        });
        const merged: ProjectState = {
          ...currentState,
          brief: (persisted.brief ?? currentState.brief) as MasterBrief | null,
          brandKit: (persisted.brandKit ?? currentState.brandKit) as ProjectState['brandKit'],
          executableProject: currentState.executableProject,
          globalStylePrompt: persisted.globalStylePrompt ?? currentState.globalStylePrompt,
          manifest: (persisted.manifest ?? currentState.manifest) as ManifestEntry | null,
          keyframes,
          transitions,
          orderedKeyframes: currentState.orderedKeyframes,
        };
        return merged;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Reconstrucción de Blobs a partir de base64 (best-effort, lazy).
        state.keyframes.forEach((kf, id) => {
          if (kf.base64 && kf.mimeType && !kf.blob) {
            base64ToBlob(kf.base64, kf.mimeType)
              .then((blob) => {
                useProjectStore.setState((s) => {
                  const cur = s.keyframes.get(id);
                  if (cur && !cur.blob) {
                    const next = new Map(s.keyframes);
                    next.set(id, { ...cur, blob });
                    return { keyframes: next };
                  }
                  return s;
                });
              })
              .catch(() => undefined);
          }
        });
      },
    },
  ),
);

function buildGlobalStylePrompt(brief: MasterBrief): string {
  const tone = brief.globalVision.toneKeywords.join(', ');
  const avoid = brief.globalVision.avoidKeywords.join(', ');
  const palette = brief.globalVision.suggestedPalette?.slice(0, 3).join(', ') ?? '';
  return [
    `Tono: ${tone || 'profesional y cercano'}.`,
    `Pacing: ${brief.globalVision.pacing}.`,
    `Música: ${brief.globalVision.musicMood || 'neutra'}.`,
    palette ? `Paleta sugerida: ${palette}.` : '',
    avoid ? `EVITAR: ${avoid}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export const selectApprovedTransitions = (s: ProjectState): KeyframeTransition[] =>
  Array.from(s.transitions.values()).filter((t) => t.status === 'done' || t.status === 'approved');
