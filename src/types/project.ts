/**
 * Project store, brand kit, export pack y jobs.
 * Spec: SPEC-S1-FOUNDATION §1.3 + ARCH-20260703-01.
 */

import type { MasterBrief, BusinessIdentity, ServiceToAdvertise, GlobalAdVision, AidaStageKey } from './brief';
import type { Keyframe, KeyframeRole } from './keyframe';
import type { KeyframeTransition, AidaNodeKey } from './transition';
import type { AnalysisJob, GenerationJob } from './progressJobs';

export interface BrandKit {
  brandName: string;
  acronym?: string;
  slogan?: string;
  palette: { primary: string; secondary: string; accent: string; bg: string; fg: string };
  fonts: { heading: string; body: string; mono: string };
  tone: string[];
  voice?: { tone: string; pace: string };
}

/** Por servicio: 4 nodos AIDA con copy listo para TTS y motion prompt listo para Veo */
export interface ServiceStageNode {
  title: string;
  voiceover: string;
  movementPrompt: string;
  cameraSpec?: { movement: string; framing: string; speed: string };
  imageHints: string[];   // 2 hints para Imagen 3
}

export interface ServicePack {
  serviceId: string;
  serviceName: string;
  atencion: ServiceStageNode;
  interes: ServiceStageNode;
  deseo: ServiceStageNode;
  accion: ServiceStageNode;
}

/** Output LLM step 2 (en S1: stub, real en S2) */
export interface ExecutableProject {
  brandKit: BrandKit;
  servicePacks: ServicePack[];
  globalStylePrompt: string;
  generatedAt: number;
}

export interface SubtitleSegment {
  id: string;
  start: number;     // seconds
  end: number;
  text: string;
  speaker?: string;
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  outline: number;
  shadow: number;
  marginV: number;
  bold: boolean;
}

export interface SubtitleMaster {
  vtt: string;            // text/vtt
  segments: SubtitleSegment[];
  style: SubtitleStyle;
}

export interface VoiceoverMaster {
  audioBlob: Blob;
  durationSeconds: number;
  segments: Array<{ nodeKey: AidaNodeKey; start: number; end: number }>;
}

export type ExportPresetName = '9:16' | '1:1' | '4:5' | '16:9';

export interface ExportPreset {
  name: ExportPresetName;
  width: number;
  height: number;
  cropMode: 'cover' | 'contain';
  safeZone?: { top: number; bottom: number; left: number; right: number };
  bitrateKbps: number;
}

export interface ExportPackEntry {
  presetName: ExportPresetName;
  blob: Blob;
  url: string;
  sizeBytes: number;
  durationSeconds: number;
}

export interface ExportPack {
  entries: ExportPackEntry[];
  generatedAt: number;
}

export interface ManifestEntry {
  timelineOrder: string[];                    // nodeKey order
  clips: Array<{
    transitionId: string;
    nodeKey: AidaNodeKey;
    duration: number;
    promptApproved: string;
    promptOriginal: string;
    fromKeyframeId: string;
    toKeyframeId: string;
    generatedAt?: number;
    hash?: string;
  }>;
  brandKit?: BrandKit;
  generatedAt: number;
  appVersion: string;
}

/** Estado global completo del proyecto (lo que persiste el store) */
export interface ProjectState {
  // Brief & metadata
  brief: MasterBrief | null;
  executableProject: ExecutableProject | null;
  brandKit: BrandKit | null;
  globalStylePrompt: string;

  // Storyboard
  keyframes: Map<string, Keyframe>;
  transitions: Map<string, KeyframeTransition>;
  orderedKeyframes: string[];

  // Generated assets (en S1: placeholder blobs)
  clips: Map<string, Blob>;
  voiceover: VoiceoverMaster | null;
  subtitles: SubtitleMaster | null;
  masterVideo: Blob | null;
  masterVideoUrl: string | null;
  exportPack: ExportPack | null;

  // Manifest final
  manifest: ManifestEntry | null;

  // UI state auxiliar (no se persiste en IDB)
  activeTransitionId: string | null;
  promptGateOpen: boolean;
  lastError: string | null;

  // ARCH-20260704-09: jobs efímeros de progreso (análisis / generación).
  // NO se persisten en IDB (ver `partialize` en projectStore).
  analysisJobs: Map<string, AnalysisJob>;
  generationJobs: Map<string, GenerationJob>;

  // Acciones (signatures, no persistidas)
  loadBrief: (brief: MasterBrief) => void;
  resetProject: () => void;
  updateBusiness: (partial: Partial<BusinessIdentity>) => void;
  addService: () => ServiceToAdvertise;
  updateService: (serviceId: string, partial: Partial<ServiceToAdvertise>) => void;
  removeService: (serviceId: string) => void;
  updateServiceStage: (serviceId: string, stage: AidaStageKey, description: string) => void;
  setGlobalVision: (partial: Partial<GlobalAdVision>) => void;

  setKeyframe: (kf: Keyframe) => void;
  uploadKeyframeImage: (role: KeyframeRole, file: File, isReuploadOverride?: boolean) => Promise<void>;
  analyzeKeyframe: (keyframeId: string) => Promise<void>;
  setKeyframeIntent: (keyframeId: string, intent: string, description?: string) => void;
  approveKeyframe: (keyframeId: string) => void;
  generateMissingKeyframes: () => Promise<void>;

  buildTransition: (fromKfId: string, toKfId: string, nodeKey: AidaNodeKey) => KeyframeTransition | null;
  approveTransitionPrompt: (transitionId: string, finalPrompt: string) => void;
  regenerateTransition: (transitionId: string) => Promise<void>;
  generateTransition: (transitionId: string) => Promise<void>;

  openPromptGate: (transitionId: string) => void;
  closePromptGate: () => void;
  setActiveTransition: (id: string | null) => void;
  setLastError: (msg: string | null) => void;

  assembleMaster: () => Promise<void>;
  updateManifest: () => void;

  // ARCH-20260704-09: acciones para badges de progreso persistentes.
  startAnalysisJob: (keyframeId: string) => void;
  finishAnalysisJob: (keyframeId: string, ok: boolean, errorMessage?: string) => void;
  startGenerationJob: (transitionId: string) => void;
  finishGenerationJob: (transitionId: string, ok: boolean, errorMessage?: string, attempts?: number) => void;
}

/** Tags UI state (no persistido) */
export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  duration?: number;
}

export interface UIState {
  currentStep: 'brief' | 'storyboard' | 'export';
  briefStep: number;       // 0..3 dentro del wizard
  toasts: Toast[];
  exportCenterOpen: boolean;
  /** S4 — id de la transición cuyo SplitViewEditor está abierto (null si ninguno). */
  splitViewTransitionId: string | null;
  /** S5 — tour guiado visto al menos una vez (persiste en localStorage). */
  hasSeenTour: boolean;
  /** S5 — flag para lanzar el tour cuando monte el wizard tras LandingPage. */
  showTourOnNextRender: boolean;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  setStep: (step: UIState['currentStep']) => void;
  setBriefStep: (n: number) => void;
  openExportCenter: () => void;
  closeExportCenter: () => void;
  openSplitView: (transitionId: string) => void;
  closeSplitView: () => void;
  /** S5 — marca el tour como visto (persiste). */
  markTourSeen: () => void;
  /** S5 — limpia el flag de tour visto (para "Volver al inicio"). */
  resetTour: () => void;
  /** S5 — activa el flag de tour en próximo render. */
  setShowTourOnNextRender: (v: boolean) => void;
  /** S5 — consume (lee + limpia) el flag de tour en próximo render. */
  consumeShowTour: () => boolean;
  /** S5 — limpia estado UI efímero (toasts, modals, tabs). NO toca hasSeenTour. */
  resetAll: () => void;
}
