# Arquitectura

```mermaid
flowchart TB
  subgraph Browser["Browser (Vite SPA)"]
    UI[React UI + Zustand]
    IDB[(IndexedDB)]
    FF[FFmpeg WASM Worker]
    JQ[Job Queue (in-memory)]
  end

  subgraph Cloudflare["Cloudflare Worker"]
    Proxy["/api/gemini/* proxy"]
  end

  subgraph GoogleAI["Google AI APIs"]
    Veo[Veo 3.1]
    Imagen[Imagen 3]
    TTS[Gemini TTS]
  end

  UI -->|loadBrief| IDB
  UI -->|video_generation| JQ
  JQ -->|Worker postMessage| FF
  JQ -->|fetch /api/gemini/*| Proxy
  Proxy -->|HTTPS + API key| Veo
  Proxy -->|HTTPS + API key| Imagen
  Proxy -->|HTTPS + API key| TTS
  FF -->|video/mp4 blob| UI
```

## Pipeline de generación

```mermaid
sequenceDiagram
  participant U as Usuario
  participant App
  participant Q as jobQueue
  participant W as Worker
  participant Proxy as Cloudflare Worker
  participant Veo
  participant FFmpeg

  U->>App: Completa BriefWizard
  App->>App: loadBrief(brief)
  App->>App: buildTransitions (6 nodos AIDA)
  U->>App: Aprueba prompts (status=approved)
  U->>App: Click "Generar Lote Completo"
  App->>Q: createBatch(6 specs)
  Q->>W: postMessage(EXECUTE)
  W->>Proxy: POST /api/gemini/video
  Proxy->>Veo: generateVideo (poll hasta done)
  Veo-->>Proxy: video bytes (mp4)
  Proxy-->>W: blob
  W-->>Q: RESULT blob
  Q->>App: onJobCompleted(clip)
  App->>IDB: persist clip
  U->>App: Click "Ensamblar Master"
  App->>FFmpeg: smartConcat(blobs)
  FFmpeg-->>App: master.mp4
  App->>IDB: persist master
  U->>App: Tab Export → Pack RRSS
  App->>FFmpeg: batchEncodePack(4 ratios)
  FFmpeg-->>App: zipBlob
```

## Keyframe Chain (anti-alucinación)

```mermaid
flowchart LR
  KF1[bumper_start] -->|transition| KF2[atencion_in]
  KF2 -->|transition| KF3[interes_in]
  KF3 -->|transition| KF4[deseo_in]
  KF4 -->|transition| KF5[accion_in]
  KF5 -->|transition| KF6[cta_final]

  KF2 -.->|Imagen 3 OUT| KF2
  KF4 -.->|Imagen 3 OUT| KF4
```

Cada transición usa **Image-to-Video** con keyframes consecutivos, evitando drift semántico. Si una transición falla (quota/safety/timeout), se aplica fallback a imagen estática con zoom (5s por nodo perdido).

## Decisiones Arquitectónicas (ADRs)

| ADR | Título | Estado |
|---|---|---|
| ADR-01 | Standalone SPA, Gemini-only, Keyframe Chain AIDA | Aceptado |
| ADR-02 | Cloudflare Worker como proxy de API keys | Aceptado |
| ADR-03 | FFmpeg WASM client-side (no servidor) | Aceptado |
| ADR-04 | Keyframe Chain con prompts por etapa (no prompt monolítico) | Aceptado |
| ADR-05 | JobQueue reactivo en lugar de generación bloqueante | Aceptado |
| ADR-06 | FFmpeg copia a `dist/ffmpeg-core/` vía postinstall (no CDN) | Aceptado |
| ADR-07 | IndexedDB para clips/master, localStorage para UI efímero | Aceptado |

## Stores (Zustand)

### `useProjectStore` — persistido en IndexedDB

Estado central del proyecto:

```ts
interface ProjectState {
  brief: MasterBrief | null;
  brandKit: BrandKit | null;
  globalStylePrompt: string;
  keyframes: Map<KeyframeId, Keyframe>;
  orderedKeyframes: KeyframeId[];
  transitions: Map<TransitionId, KeyframeTransition>;
  clips: Map<TransitionId, Blob>;
  voiceover: { audioBlob: Blob; vtt: string } | null;
  subtitles: { vtt: string; style: SubtitleStyle } | null;
  masterVideo: Blob | null;
  masterVideoUrl: string | null;
  exportPack: ExportPackOutput | null;
  manifest: ProjectManifest | null;
}
```

Acciones clave: `loadBrief`, `buildTransition`, `approveTransitionPrompt`, `setMasterVideo`, `resetProject`.

### `useUIStore` — localStorage (parcial)

Estado efímero:

```ts
interface UIState {
  currentStep: 'brief' | 'storyboard' | 'export';
  briefStep: 0 | 1 | 2 | 3;
  toasts: Toast[];
  exportCenterOpen: boolean;
  splitViewTransitionId: string | null;
  hasSeenTour: boolean;
  showTourOnNextRender: boolean;
}
```

`hasSeenTour` se persiste en `localStorage['bridge.hasSeenTour.v1']`. El resto es transitorio.

### `useApiKeysStore` — sesión

Estado de conexión al proxy:

```ts
interface ApiKeysState {
  proxyConnected: boolean;
  lastCheckedAt: number | null;
  latencyMs: number | null;
  safetyFlagsEnabled: boolean;
}
```

## Workers

### `src/workers/job.worker.ts`

Maneja `video_generation` y `image_generation` con retry exponencial (1s, 2s, 4s, 8s, 16s) y clasificación de errores:

- `quota rate` → retryable
- `safety blocked` → no retry, fallback inmediato
- `timeout` → retryable

Cada resultado se comunica con `{ type: 'RESULT', jobId, blob, fallbackUsed, fallbackReason, attempts, totalLatencyMs }`.

### `src/workers/ffmpeg.worker.ts`

Handlers soportados:

- `INIT` — cargar core wasm
- `CONCAT` — concatenar clips en orden
- `BURN_SUBS` — quemar VTT en video
- `MIX_AUDIO` — mezclar voiceover + música
- `SMART_CONCAT` — concat con subs + audio opcionales
- `EXPORT_RATIO` — encode a un aspect ratio (9:16, 1:1, 4:5, 16:9)
- `STATIC_FROM_IMAGE` — imagen → video estático (fallback)
- `TERMINATE` — cleanup

## Servicios

| Servicio | Responsabilidad |
|---|---|
| `gemini/client.ts` | Fetch wrapper con backoff y retry |
| `gemini/video.ts` | Veo I2V + polling + classify errors |
| `gemini/imageAnalysis.ts` | Vision → VisualAnalysis |
| `gemini/keyframeGenerator.ts` | Imagen 3 para KF_OUT |
| `gemini/tts.ts` | Gemini TTS → PCM → WAV |
| `costEstimator.ts` | Pricing hardcoded por modelo |
| `jobQueue.ts` | BackgroundJobQueue con IDB + parallelSlots=3 |
| `fallbackStrategy.ts` | Strategy 1: static image → Strategy 2: plain color |
| `smartConcat.ts` | FFmpeg smart concat con subs + audio opcionales |
| `shareLink.ts` | blob URL + QR + embed |
| `exportBatch.ts` | Multi-ratio encode paralelo |
| `telemetry.ts` | Opt-in GDPR-safe (con PII limitado) |
| `analytics.ts` | S6 — Eventos anónimos opt-in (sin PII) |
| `versionHistory.ts` | IDB store `bridge-versions` (max 5/transición) |
| `notification.ts` | Notification API + deep-link |
| `safeZoneBurn.ts` | Safe zones visuales en export |
| `exportPresets.ts` | Catálogo de aspect ratios + sizes |
| `zipHelper.ts` | JSZip wrapper con manifests |

## Hooks

- `useJobs()` — suscripción reactiva al jobQueue
- `useJobProgress()` — `allJobsCompleted` / `hasPending` (notifica al completar batch)
- `useViewport()` — breakpoint mobile/tablet/desktop
- `useFocusTrap(active, containerRef)` — focus trap para modales
- `useModalKeyboardShortcuts({enabled, onClose})` — Esc handler
- `useKeyboardShortcuts(config, enabled)` — atajos globales (g=Gallery, e=Export, etc.)

## Flujo de datos en una sesión típica

```mermaid
sequenceDiagram
  participant U
  participant LP as LandingPage
  participant W as BriefWizard
  participant SB as Storyboard
  participant EC as ExportCenter
  participant PR as ProjectStore

  U->>LP: Carga inicial
  LP-->>U: Elige sector o "Crear mi primer spot"
  U->>W: Completa 3 pasos
  W->>PR: loadBrief(brief)
  PR->>PR: buildInitialKeyframes() + transitions
  U->>SB: Aprueba prompts por nodo
  U->>SB: Click Generar Lote
  SB->>PR: setMasterVideo (post FFmpeg)
  U->>EC: Tab Export → Pack RRSS
  EC->>PR: read masterVideo
  EC->>FFmpeg: batchEncodePack(4 ratios)
  EC-->>U: download ZIP
```

## Decisiones NO tomadas (deferrred)

- **Multi-tenant**: cada usuario tiene su propio brief; no hay sync entre cuentas.
- **Versionado de prompts en la nube**: solo local (IndexedDB `bridge-versions`).
- **Real-time collab**: fuera de scope (uso individual).
- **Marketplace de sector templates**: fuera de scope (templates hardcoded).