# API Reference

> Contratos de tipos, stores, services y hooks. Spec: SPEC-S6-TESTS-CICD §6.5.

## Types

### Brief

```typescript
interface MasterBrief {
  id: string;
  business: BusinessIdentity;
  services: ServiceToAdvertise[];
  globalVision: GlobalAdVision;
  createdAt: number;
  updatedAt: number;
}

interface BusinessIdentity {
  name: string;
  acronym?: string;
  slogan?: string;
  description: string;
  sector: BusinessSector;
  audience: string;
  differentiators: string[];
  logoBlob: Blob | null;
  contactPhone?: string;
  contactLocation?: string;
}

type BusinessSector =
  | 'automotriz' | 'estetica' | 'comida' | 'salud'
  | 'inmobiliaria' | 'educacion' | 'tecnologia' | 'retail' | 'otro';

interface ServiceToAdvertise {
  id: string;
  name: string;
  description: string;
  keyBenefit: string;
  price?: string;
  stages: { attention: string; interest: string; desire: string; action: string };
}

interface GlobalAdVision {
  style: string;
  musicMood: string;
  pacing: 'rapido' | 'balanceado' | 'cinematico';
  toneKeywords: string[];
  avoidKeywords: string[];
}
```

### Keyframes y Transiciones

```typescript
interface Keyframe {
  id: string;
  role: 'bumper_start' | 'atencion_in' | 'interes_in' | 'deseo_in' | 'accion_in' | 'cta_final';
  label: string;
  description: string;
  source: 'user_upload' | 'generated_imagen3' | 'placeholder';
  blob?: Blob;
  url?: string;
  status: 'empty' | 'uploaded' | 'generated';
  timestamp: number;
}

interface KeyframeTransition {
  id: string;
  nodeKey: 'bumper' | 'atencion' | 'interes' | 'deseo' | 'accion' | 'cta';
  fromKeyframe: string;
  toKeyframe: string;
  prompt: string;
  status: 'draft' | 'pending' | 'approved' | 'generating' | 'done' | 'failed' | 'fallback_done' | 'cancelled';
  videoBlob?: Blob;
  videoUrl?: string;
  fallbackReason?: string;
  errorMessage?: string;
  generatedAt?: number;
}
```

### Jobs

```typescript
interface JobSpec {
  kind: 'video_generation' | 'image_generation';
  transitionId?: string;
  transition?: KeyframeTransition;
  keyframeFrom?: Keyframe;
  keyframeTo?: Keyframe;
  keyframeId?: string;
  keyframe?: Keyframe;
  intent?: string;
  brief: MasterBrief | null;
}

interface BackgroundJob {
  id: string;
  kind: 'video_generation' | 'image_generation';
  status: 'queued' | 'active' | 'paused' | 'done' | 'failed' | 'fallback_done' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  latencyMs?: number;
  fallbackUsed?: boolean;
  fallbackReason?: string;
}

interface JobQueueState {
  jobs: BackgroundJob[];
  activeJobs: BackgroundJob[];
  completedJobs: number;
  failedJobs: number;
}
```

### Export

```typescript
type AspectRatio = '9:16' | '1:1' | '4:5' | '16:9';

interface ExportPackOptions {
  enabledRatios: AspectRatio[];
  includeSafeZones: boolean;
  burnSubtitles: boolean;
  mixVoiceover: boolean;
  includeManifest: boolean;
  parallelSlots: number;
}

interface ExportPackOutput {
  videos: Array<{ aspectRatio: AspectRatio; blob: Blob; sizeMB: number; duration: number }>;
  zip?: { blob: Blob; filename: string; totalSizeMB: number };
  manifests?: Record<string, Blob>;
}
```

## Stores

### `useProjectStore`

```typescript
const useProjectStore = create<ProjectState>()((set, get) => ({
  brief, brandKit, globalStylePrompt,
  keyframes, orderedKeyframes, transitions, clips,
  voiceover, subtitles, masterVideo, masterVideoUrl,
  exportPack, manifest,
  // Actions:
  loadBrief(brief): void;
  resetProject(): void;
  buildTransition(fromId, toId, nodeKey): KeyframeTransition | null;
  approveTransitionPrompt(transitionId, prompt): void;
  rejectTransitionPrompt(transitionId, reason): void;
  generateTransition(transitionId): Promise<Blob>;  // ADR-04 gate enforced
  setMasterVideo(blob: Blob, url: string): void;
  setVoiceover(audioBlob: Blob, vtt: string): void;
  setSubtitles(vtt: string, style: SubtitleStyle): void;
  updateManifest(): void;
  setLastError(message: string | null): void;
}));

const selectApprovedTransitions = (s: ProjectState): KeyframeTransition[];
```

### `useUIStore`

```typescript
const useUIStore = create<UIState>()((set, get) => ({
  currentStep, briefStep, toasts,
  exportCenterOpen, splitViewTransitionId,
  hasSeenTour, showTourOnNextRender,
  // Actions:
  setStep(step: 'brief' | 'storyboard' | 'export'): void;
  setBriefStep(n: 0 | 1 | 2 | 3): void;
  addToast({ kind, message, duration? }): void;
  dismissToast(id: string): void;
  openExportCenter(): void;
  closeExportCenter(): void;
  openSplitView(transitionId: string): void;
  closeSplitView(): void;
  markTourSeen(): void;
  resetTour(): void;
  setShowTourOnNextRender(v: boolean): void;
  consumeShowTour(): boolean;
  resetAll(): void;
}));
```

### `useApiKeysStore`

```typescript
const useApiKeysStore = create<ApiKeysState>()((set) => ({
  proxyConnected, lastCheckedAt, latencyMs, safetyFlagsEnabled,
  // Actions:
  checkProxy(): Promise<void>;
  setSafetyFlags(enabled: boolean): void;
}));
```

## Services

### `gemini/client.ts`

```typescript
interface VeoClientOptions {
  baseUrl?: string;             // default '/api/gemini'
  maxRetries?: number;          // default 5
  initialBackoffMs?: number;    // default 1000
  onAttempt?: (n: number, err: Error) => void;
}

function createVeoClient(opts?: VeoClientOptions): {
  generateVideo(params: { prompt: string; keyframeFrom: Blob; keyframeTo: Blob; duration: 5 | 8 }): Promise<Blob>;
  generateImage(params: { prompt: string; aspectRatio?: AspectRatio }): Promise<Blob>;
  analyzeImage(params: { image: Blob; prompt: string }): Promise<VisualAnalysis>;
  textToSpeech(params: { text: string; voice: string }): Promise<Blob>;
};
```

### `jobQueue.ts`

```typescript
interface BackgroundJobQueue {
  initialize(): Promise<void>;
  createBatch(specs: JobSpec[]): Promise<string[]>;
  getQueueState(): JobQueueState;
  subscribe(fn: (state: JobQueueState) => void): () => void;
  pause(jobId: string): Promise<void>;
  resume(jobId: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
  cancelAll(): Promise<void>;
  clearCompleted(): Promise<void>;
  // Test helpers:
  _seed(jobs: BackgroundJob[]): void;
  _internalJobs(): BackgroundJob[];
}
const jobQueue: BackgroundJobQueue;
```

### `ffmpeg.ts`

```typescript
interface FFmpegService {
  isLoaded: boolean;
  onProgress: ((p: { progress: number; time: number }) => void) | null;
  load(): Promise<void>;
  smartConcat(params: { blobs: Array<{ role: string; blob: Blob }>; timelineOrder: string[]; subtitleVtt?: string; voAudio?: Blob }): Promise<Blob>;
  burnSubtitles(video: Blob, vtt: string, style: SubtitleStyle): Promise<Blob>;
  mixAudio(video: Blob, audio: Blob): Promise<Blob>;
  exportRatio(master: Blob, ratio: AspectRatio): Promise<Blob>;
  staticVideoFromImage(image: Blob, durationSec: number): Promise<Blob>;
  terminate(): void;
}
const ffmpegService: FFmpegService;
```

### `exportBatch.ts`

```typescript
function batchEncodePack(params: {
  masterBlob: Blob;
  masterDurationSec: number;
  options: ExportPackOptions;
  brandKit: BrandKit | null;
  subtitleVtt?: string;
  subtitleStyle?: SubtitleStyle;
  voAudio?: { blob: Blob; filename: string };
  manifestJson?: { blob: Blob; filename: string };
  onProgress?: (ratio: AspectRatio, pct: number) => void;
}): Promise<ExportPackOutput>;

function vttToSrt(vtt: string): string;
```

### `fallbackStrategy.ts`

```typescript
interface FallbackOptions {
  durationSec: number;
  width: number;
  height: number;
  keyframeImage?: Blob;
  brandColors?: { primary: string; secondary: string; bg: string };
  onProgress?: (pct: number) => void;
}

function generateFallbackVideo(opts: FallbackOptions): Promise<Blob>;
```

### `shareLink.ts`

```typescript
interface ShareLinkInput {
  masterBlob: Blob;
  brandName: string;
  expiresInHours?: number;  // default 24
}

interface ShareLink {
  url: string;
  qrDataUrl: string;
  embedHtml: string;
  expiresAt: number;
}

function generateShareLink(input: ShareLinkInput): Promise<ShareLink>;
```

### `analytics.ts` (S6)

```typescript
type AnalyticsEvent =
  | { type: 'session_started'; sessionId: string; timestamp: number }
  | { type: 'brief_completed'; sector: string; servicesCount: number; timestamp: number }
  | { type: 'first_generation'; nodeCount: number; timestamp: number }
  | { type: 'export_completed'; format: string; sizeMB: number; timestamp: number }
  | { type: 'fallback_activated'; reason: string; ratio: string; timestamp: number }
  | { type: 'session_ended'; durationSec: number; timestamp: number };

interface AnalyticsService {
  isEnabled(): boolean;
  setOptIn(enabled: boolean): void;
  record(event: AnalyticsEvent): void;
  getEvents(): AnalyticsEvent[];
  _reset(): void;
}
const analytics: AnalyticsService;
```

## Hooks

### `useJobs(): JobQueueState`

Suscripción reactiva al estado del job queue.

```typescript
const { jobs, activeJobs, completedJobs, failedJobs } = useJobs();
```

### `useJobProgress(): { allJobsCompleted: boolean; hasPending: boolean }`

Detecta transiciones del batch completo. Dispara notification cuando todos terminan.

```typescript
const { allJobsCompleted, hasPending } = useJobProgress();
useEffect(() => {
  if (allJobsCompleted) showVideoReadyNotification();
}, [allJobsCompleted]);
```

### `useViewport(): { isMobile: boolean; isTablet: boolean; isDesktop: boolean; width: number }`

Breakpoint responsive. Mobile <640px, Tablet 640-1024, Desktop ≥1024.

### `useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement>): void`

Atrapa el foco dentro del container mientras esté activo. Usar en modales.

### `useModalKeyboardShortcuts({ enabled, onClose }): void`

Registra `Escape` para cerrar. Limpia el listener al desmontar.

### `useKeyboardShortcuts(config: Record<string, KeyboardShortcut>, enabled?: boolean): void`

Atajos globales. Formato:

```typescript
useKeyboardShortcuts({
  'g': { key: 'g', label: 'Ir a Storyboard', action: () => setStep('storyboard') },
  'mod+s': { key: 's', mod: true, label: 'Guardar', action: () => save() },
}, true);
```

## Workers

### `job.worker.ts`

Mensajes soportados:

```typescript
type WorkerInbound =
  | { type: 'EXECUTE'; job: BackgroundJob }
  | { type: 'CANCEL'; jobId: string };

type WorkerOutbound =
  | { type: 'PROGRESS'; jobId: string; pct: number }
  | { type: 'RESULT'; jobId: string; blob: Blob; fallbackUsed: boolean; fallbackReason?: string; attempts: number; totalLatencyMs: number }
  | { type: 'ERROR'; jobId: string; message: string };
```

### `ffmpeg.worker.ts`

```typescript
type FFmpegInbound =
  | { type: 'INIT' }
  | { type: 'CONCAT'; clips: Array<{ role: string; blob: Blob }> }
  | { type: 'BURN_SUBS'; video: Blob; vtt: string; style: SubtitleStyle }
  | { type: 'MIX_AUDIO'; video: Blob; audio: Blob }
  | { type: 'SMART_CONCAT'; params: { blobs: Array<{ role: string; blob: Blob }>; subtitleVtt?: string; voAudio?: Blob } }
  | { type: 'EXPORT_RATIO'; master: Blob; ratio: AspectRatio }
  | { type: 'STATIC_FROM_IMAGE'; image: Blob; durationSec: number }
  | { type: 'TERMINATE' };

type FFmpegOutbound =
  | { type: 'PROGRESS'; pct: number; time?: number }
  | { type: 'DONE'; blob: Blob }
  | { type: 'ERROR'; message: string };
```

## Constants

### Sector IDs

```typescript
const SECTOR_IDS = [
  'automotriz', 'estetica', 'comida', 'salud',
  'inmobiliaria', 'otro',
] as const;
```

### Aspect Ratios

```typescript
const ASPECT_RATIOS = ['9:16', '1:1', '4:5', '16:9'] as const;
```

### Veo defaults

```typescript
const VEO_DEFAULTS = {
  durationSec: 5,
  temperature: 0.7,
  maxRetries: 5,
  initialBackoffMs: 1000,
} as const;
```

### Cost estimator rates (USD)

| Modelo | Rate | Unidad |
|---|---|---|
| Veo 3.1 I2V | $0.40 | por segundo de video |
| Imagen 3 | $0.04 | por imagen |
| Gemini TTS | $0.000016 | por carácter |