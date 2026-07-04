# SPEC-S3-EXPORT: Sprint 3 — Export Multi-Formato + UX Crítica

**ID:** `IMPL-20260703-03`  
**Fecha:** 2026-07-03  
**Estado:** `[ ] Planificado` → `[~] En Progreso`  
**Dependencia:** S1 ✓ + S2 ✓ Completados  
**Duración Estimada:** 4-5 horas  
**Responsable:** SOFIA (delegación)  
**Auditor:** GEMINI (Post-S3)  
**Handoff:** `context/interconsultas/S3-handoff.md`

---

## 🎯 ENTREGABLE DEMOSTRABLE (Definition of Done)

> **Flujo completo de export empresarial funcionando:**
>
> 1. Usuario tiene `master.mp4` 9:16 <30s generado (de S1/S2)
> 2. Va a **Export Center rediseñado** con 4 tabs: `Master | Pack RRSS | Assets | Manifest`
> 3. Tab **Pack RRSS** muestra:
>    ```
>    📐 RATIOS DISPONIBLES
>    ☑ Reels / TikTok / Shorts       (9:16)   1080×1920
>    ☑ Feed Instagram (cuadrado)     (1:1)    1080×1080
>    ☑ Feed Instagram (vertical)     (4:5)    1080×1350
>    ☐ YouTube / Facebook            (16:9)   1920×1080
>
>    ⚙️  OPCIONES AVANZADAS
>    ☑ Incluir Safe Zones visuales    (barras de plataforma)
>    ☑ Quemar subtítulos en video
>    ☑ Watermark sutil marca        (logo pequeño bottom-right @8% opacity)
>
>    💾  MANIFEST
>    ☑ Incluir manifest.json con metadatos completos
>
>    [ Generar Pack RRSS (~60s) ]
>    ```
> 4. Click → **FFmpeg Batch Worker** ejecuta 4 encodes en paralelo con progreso por ratio
> 5. **ZIP descargable** contiene:
>    - `master_9x16.mp4` (1080×1920, H.264 5Mbps)
>    - `master_1x1.mp4` (1080×1080, H.264 4Mbps)
>    - `master_4x5.mp4` (1080×1350, H.264 4Mbps)
>    - `master_16x9.mp4` (1920×1080, H.264 6Mbps) si seleccionado
>    - `subs.srt` (subtítulos independientes)
>    - `vo.wav` (locución limpia)
>    - `manifest.json` (metadatos: timeline, duraciones, prompts aprobados, costs)
> 6. Tab **Share** muestra:
>    - Link firmado (blob URL con expiración 24h)
>    - QR code generado client-side
>    - Botón "Copiar link"
>    - Botón "Copiar embed HTML"

---

## 📋 BACKLOG DETALLADO DE TAREAS S3

| # | Tarea | Criterio de Aceptación | Esfuerzo |
|---|-------|------------------------|----------|
| **3.1** | `ExportPresets` con 4 ratios + crop inteligente | Tabla de presets con width/height/cropMode/bitrate por ratio | M |
| **3.2** | `SafeZoneOverlay` con plantillas de plataforma | Overlay visual en preview + burn option en FFmpeg | M |
| **3.3** | `FFmpegBatchWorker` cola 4 encodes paralelos | Barra progreso por ratio + descarga ZIP final | L |
| **3.4** | `ShareLinkGenerator` (blob URL + expiración + QR) | Link copiable + QR visualizado + expiración 24h | S |
| **3.5** | `ExportCenter` redesign con 4 tabs | UI funcional con Master, Pack RRSS, Assets, Manifest | M |
| **3.6** | ZIP packaging con JSZip para descarga única | `pack_rrss.zip` descargable en ~3s tras 4 encodes listos | S |
| **3.7** | Consolidación: `ExportCenter.tsx` → `src/components/generation/` | Mover archivo y actualizar imports | S |
| **3.8** | Fallback brand color (de GEMINI S2 audit observación O1) | Strategy `plain_color_with_text` usa `brandKit.colors.primary` | S |
| **3.9** | Telemetría `fallback_activated` (de GEMINI O2) | Evento en `localStorage` events array | S |

**Esfuerzo total:** ~12-16h equivalente → 4-5h con trabajo paralelo y patrones ya establecidos (S1 + S2 sientan bases)

---

## 🏗️ ARQUITECTURA DETALLADA

### Tipos Nuevos

```typescript
// src/types/export.ts (ampliar)
export type AspectRatio = '9:16' | '1:1' | '4:5' | '16:9';
export type Platform = 'reels' | 'tiktok' | 'shorts' | 'feed_ig_square' | 'feed_ig_portrait' | 'youtube' | 'facebook';

export interface ExportPreset {
  id: string;
  platform: Platform;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  cropMode: 'center' | 'face' | 'smart';
  bitrate: number;        // kbps video
  audioBitrate: number;   // kbps audio
  estimatedSizeMB: number; // Por 30s video
}

export const EXPORT_PRESETS: Record<AspectRatio, ExportPreset> = {
  '9:16': {
    id: 'reels_tiktok_shorts',
    platform: 'reels',
    aspectRatio: '9:16',
    width: 1080, height: 1920,
    cropMode: 'center',
    bitrate: 5000, audioBitrate: 128,
    estimatedSizeMB: 19,
  },
  '1:1': {
    id: 'feed_ig_square',
    platform: 'feed_ig_square',
    aspectRatio: '1:1',
    width: 1080, height: 1080,
    cropMode: 'center',
    bitrate: 4000, audioBitrate: 128,
    estimatedSizeMB: 15,
  },
  '4:5': {
    id: 'feed_ig_portrait',
    platform: 'feed_ig_portrait',
    aspectRatio: '4:5',
    width: 1080, height: 1350,
    cropMode: 'center',
    bitrate: 4000, audioBitrate: 128,
    estimatedSizeMB: 15,
  },
  '16:9': {
    id: 'youtube_facebook',
    platform: 'youtube',
    aspectRatio: '16:9',
    width: 1920, height: 1080,
    cropMode: 'center',
    bitrate: 6000, audioBitrate: 192,
    estimatedSizeMB: 23,
  },
} as const;

export interface SafeZone {
  platform: Platform;
  topBarHeight: number;     // pixels (safe zone top para captions)
  bottomBarHeight: number;
  sideSafeZone: number;     // pixels (safe zone horizontal)
  description: string;
}

export const SAFE_ZONES: Record<Platform, SafeZone> = {
  reels: { platform: 'reels', topBarHeight: 0, bottomBarHeight: 250, sideSafeZone: 50,
           description: 'IG Reels: 250px bottom reserv. para description, captions & username' },
  tiktok: { platform: 'tiktok', topBarHeight: 100, bottomBarHeight: 350, sideSafeZone: 30,
            description: 'TikTok: username top, descripción + boton share bottom' },
  shorts: { platform: 'shorts', topBarHeight: 50, bottomBarHeight: 100, sideSafeZone: 30,
            description: 'YouTube Shorts: subscribe button bottom' },
  feed_ig_square: { platform: 'feed_ig_square', topBarHeight: 0, bottomBarHeight: 60, sideSafeZone: 30,
                    description: 'IG Feed square: small bottom margin' },
  feed_ig_portrait: { platform: 'feed_ig_portrait', topBarHeight: 0, bottomBarHeight: 80, sideSafeZone: 30,
                      description: 'IG Feed portrait: 80px bottom margin' },
  youtube: { platform: 'youtube', topBarHeight: 0, bottomBarHeight: 60, sideSafeZone: 0,
             description: 'YouTube landscape: title overlay area bottom' },
  facebook: { platform: 'facebook', topBarHeight: 0, bottomBarHeight: 80, sideSafeZone: 0,
             description: 'Facebook Feed: name + caption bottom' },
} as const;

export interface ExportPackOptions {
  enabledRatios: AspectRatio[];  // ['9:16', '1:1', '4:5'] por defecto
  includeSafeZones: boolean;     // Visual overlay
  includeBurnedSubs: boolean;    // Burn subs en video
  includeWatermark: boolean;
  watermarkImageBase64?: string; // logo del cliente
  watermarkOpacity: number;      // 0-1, default 0.08
  watermarkPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  includeManifest: boolean;
  includeVOAudio: boolean;
  includeSubtitlesSRT: boolean;
}

export interface ExportPackOutput {
  videos: { aspectRatio: AspectRatio; blob: Blob; sizeMB: number; filename: string }[];
  subtitles?: { srtBlob: Blob; filename: string };
  voAudio?: { wavBlob: Blob; filename: string };
  manifest?: { jsonBlob: Blob; filename: string };
  zip?: { blob: Blob; filename: string; totalSizeMB: number };
  generatedAt: number;
  totalDuration: number; // segundos
}
```

---

## 📦 ESPECIFICACIÓN DETALLADA POR TAREA

### TAREA 3.1 — ExportPresets

**Archivo:** `src/types/export.ts` (definir) + `src/services/exportPresets.ts` (lógica)

```typescript
// src/services/exportPresets.ts
import { EXPORT_PRESETS, type AspectRatio, type ExportPreset } from '@/types/export';

export function getPreset(ratio: AspectRatio): ExportPreset {
  return EXPORT_PRESETS[ratio];
}

export function listAllPresets(): ExportPreset[] {
  return Object.values(EXPORT_PRESETS);
}

export function estimateTotalSizeMB(enabled: AspectRatio[], durationSec: number): number {
  return enabled.reduce((acc, r) => {
    return acc + (EXPORT_PRESETS[r].estimatedSizeMB * durationSec / 30);
  }, 0);
}

export function estimateEncodingTime(enabled: AspectRatio[]): number {
  // 4 encodes en paralelo = 1x tiempo, secuencial = 4x
  // Asumimos parallelSlots=4
  const baseTimePerRatio = 12; // segundos promedio
  return enabled.length === 0 ? 0 : baseTimePerRatio + (enabled.length - 1) * 2;
}
```

**Tests:**
```typescript
// src/__tests__/exportPresets.test.ts
- listAllPresets retorna los 4 ratios con campos completos
- estimateTotalSizeMB con ['9:16'] para 30s → ~19 MB
- estimateEncodingTime con [] → 0
- estimateEncodingTime con 4 ratios en paralelo → ~18s (no 48s serial)
```

---

### TAREA 3.2 — SafeZoneOverlay

**Componente:** `src/components/export/SafeZonePreview.tsx`

```tsx
interface SafeZonePreviewProps {
  aspectRatio: AspectRatio;
  safeZone: SafeZone;
}

function SafeZonePreview({ aspectRatio, safeZone }: SafeZonePreviewProps) {
  const preset = EXPORT_PRESETS[aspectRatio];
  return (
    <div className="relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden"
         style={{ aspectRatio: aspectRatio.replace(':', '/'), maxWidth: 240 }}>
      {/* Video preview area */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
      
      {/* Safe zone overlays */}
      {safeZone.topBarHeight > 0 && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/20 border-b-2 border-red-500/50"
             style={{ height: `${(safeZone.topBarHeight / preset.height) * 100}%` }}>
          <span className="absolute top-1 left-1 text-[9px] font-bold text-red-300 px-1 bg-slate-950/70 rounded">
            {safeZone.topBarHeight}px (no captions)
          </span>
        </div>
      )}
      
      {safeZone.bottomBarHeight > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-amber-500/20 border-t-2 border-amber-500/50"
             style={{ height: `${(safeZone.bottomBarHeight / preset.height) * 100}%` }}>
          <span className="absolute bottom-1 right-1 text-[9px] font-bold text-amber-300 px-1 bg-slate-950/70 rounded">
            {safeZone.bottomBarHeight}px
          </span>
        </div>
      )}
      
      {/* Side safe zones */}
      {safeZone.sideSafeZone > 0 && (
        <>
          <div className="absolute top-0 bottom-0 left-0 bg-yellow-500/10"
               style={{ width: `${(safeZone.sideSafeZone / preset.width) * 100}%` }} />
          <div className="absolute top-0 bottom-0 right-0 bg-yellow-500/10"
               style={{ width: `${(safeZone.sideSafeZone / preset.width) * 100}%` }} />
        </>
      )}
      
      {/* Ratio label */}
      <div className="absolute top-2 right-2 text-xs font-bold text-white bg-slate-950/80 px-2 py-0.5 rounded">
        {aspectRatio}
      </div>
    </div>
  );
}
```

**Burn-in safe zone en FFmpeg (opcional):**

```typescript
function generateSafeZoneOverlay(video: Blob, safeZone: SafeZone, preset: ExportPreset): Promise<Blob> {
  const filter = [
    `drawbox=x=0:y=0:w=iw:h=${safeZone.topBarHeight}:color=red@0.15:t=fill`,
    `drawbox=x=0:y=ih-${safeZone.bottomBarHeight}:w=iw:h=${safeZone.bottomBarHeight}:color=red@0.15:t=fill`,
    safeZone.sideSafeZone > 0 ? `drawbox=x=0:y=0:w=${safeZone.sideSafeZone}:h=ih:color=red@0.15:t=fill` : '',
    safeZone.sideSafeZone > 0 ? `drawbox=x=iw-${safeZone.sideSafeZone}:y=0:w=${safeZone.sideSafeZone}:h=ih:color=red@0.15:t=fill` : '',
  ].filter(Boolean).join(',');

  return ffmpegService.execute({
    command: 'applySafeZone',
    input: { video },
    options: { filter },
  });
}
```

**Tests:**
```typescript
- SafeZonePreview renderiza con 4 ratios diferentes sin overflow
- Burn overlay genera un video con red boxes visibles
- Side safe zones solo aparecen si sideSafeZone > 0
```

---

### TAREA 3.3 — FFmpegBatchWorker

**Archivo nuevo:** `src/workers/exportBatch.worker.ts` (worker dedicado, no reutiliza ffmpeg.worker.ts porque ratio scale es operación pesada)

**Servicio:** `src/services/exportBatch.ts`

```typescript
// src/services/exportBatch.ts
import JSZip from 'jszip';

export class ExportBatchService {
  private ffmpegWorker: Worker;
  private activeJobs: Map<string, AbortController>;
  
  async batchEncode(
    masterBlob: Blob,
    options: ExportPackOptions,
    brandPalette: Palette,
    onProgress?: (ratio: AspectRatio, percent: number) => void,
    abortSignal?: AbortSignal
  ): Promise<ExportPackOutput> {
    
    this.activeJobs.clear();
    
    const videos: ExportPackOutput['videos'] = [];
    const tasks = options.enabledRatios.map(ratio => ({
      ratio,
      promise: this.encodeOneRatio(masterBlob, ratio, options, brandPalette, (p) => onProgress?.(ratio, p), abortSignal)
        .then(result => {
          videos.push(result);
          return result;
        })
    }));
    
    // Wait for all (parallel)
    await Promise.allSettled(tasks);
    
    // Build manifest
    const manifest = options.includeManifest 
      ? await this.buildManifest(videos, options) 
      : undefined;
    
    // Build subtitles SRT (S1 ya tiene VTT, lo convertimos)
    const subs = options.includeSubtitlesSRT 
      ? await this.convertVttToSrt(...) 
      : undefined;
    
    // Build VO audio (S1 ya tiene vo.wav)
    const vo = options.includeVOAudio 
      ? { wavBlob: projectState.voiceover.blob, filename: 'vo.wav' } 
      : undefined;
    
    // Build ZIP
    const zip = await this.buildZip(videos, subs, vo, manifest);
    
    return { videos, subtitles: subs, voAudio: vo, manifest, zip, ... };
  }
  
  private async encodeOneRatio(
    masterBlob: Blob,
    ratio: AspectRatio,
    options: ExportPackOptions,
    palette: Palette,
    onProgress: (p: number) => void,
    abortSignal?: AbortSignal
  ): Promise<{ aspectRatio: AspectRatio; blob: Blob; sizeMB: number; filename: string }> {
    const preset = EXPORT_PRESETS[ratio];
    
    // FFmpeg scale + crop + (opcional safe zones overlay) + (opcional burn subs) + (opcional watermark)
    const filter = buildRatioFilter(masterBlob, preset, options, ratio);
    
    const blob = await ffmpegService.execute({
      command: 'exportRatio',
      input: { master: masterBlob },
      options: { ...filter, preset },
      onProgress,
      signal: abortSignal,
    });
    
    return {
      aspectRatio: ratio,
      blob,
      sizeMB: blob.size / (1024 * 1024),
      filename: `master_${ratio.replace(':', 'x')}.mp4`,
    };
  }
  
  private async buildZip(...): Promise<{ blob: Blob; ... }> {
    const zip = new JSZip();
    videos.forEach(v => zip.file(v.filename, v.blob));
    if (subs) zip.file(subs.filename, subs.srtBlob);
    if (vo) zip.file(vo.filename, vo.wavBlob);
    if (manifest) zip.file(manifest.filename, manifest.jsonBlob);
    return {
      blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }),
      filename: `bridge_pack_rrss_${Date.now()}.zip`,
      totalSizeMB: ...,
    };
  }
}

export const exportBatchService = new ExportBatchService();
```

**Worker FFmpeg dedicado:**

```typescript
// src/workers/exportBatch.worker.ts
import { createFFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg({ corePath: '/ffmpeg-core/ffmpeg-core.js' });
let isLoaded = false;

self.onmessage = async (e) => {
  const { type, payload, requestId } = e.data;
  
  if (type === 'INIT') {
    if (!isLoaded) { await ffmpeg.load(); isLoaded = true; }
    self.postMessage({ type: 'READY', requestId });
    return;
  }
  
  if (type === 'EXPORT_RATIO') {
    const { masterBlob, preset, filter, watermark, burnSubs, vttContent, subtitleStyle } = payload;
    
    await ffmpeg.writeFile('master.mp4', new Uint8Array(await masterBlob.arrayBuffer()));
    
    let ffmpegArgs = ['-i', 'master.mp4'];
    
    // Build filter chain
    const filters: string[] = [];
    
    // Scale + crop (center by default)
    filters.push(`scale=${preset.width}:${preset.height}:force_original_aspect_ratio=${preset.cropMode === 'cover' ? 'increase' : 'decrease'}`);
    if (preset.cropMode === 'cover') {
      filters.push(`crop=${preset.width}:${preset.height}`);
    } else {
      filters.push(`pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:color=black@0`);
    }
    
    // Burn subtitles
    if (burnSubs && vttContent) {
      await ffmpeg.writeFile('subs.vtt', new TextEncoder().encode(vttContent));
      const forceStyle = `FontName=${subtitleStyle.fontFamily},FontSize=${subtitleStyle.fontSize},PrimaryColour=${hexToASS(subtitleStyle.color)},Alignment=2,MarginV=${subtitleStyle.marginV}`;
      filters.push(`subtitles=subs.vtt:force_style='${forceStyle}'`);
    }
    
    // Watermark (logo bottom-right)
    if (watermark?.base64) {
      await ffmpeg.writeFile('wm.png', Uint8Array.from(atob(watermark.base64), c => c.charCodeAt(0)));
      filters.push(`overlay=W-w-30:H-h-30:format=auto`);
      ffmpegArgs.push('-i', 'wm.png');
    }
    
    // Safe zone overlay
    if (filter.safeZone) {
      // drawbox filters...
    }
    
    ffmpegArgs.push('-vf', filters.join(','));
    ffmpegArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', `${preset.bitrate}k`);
    ffmpegArgs.push('-c:a', 'aac', '-b:a', `${preset.audioBitrate}k`);
    ffmpegArgs.push('-movflags', '+faststart');
    ffmpegArgs.push('-y', 'output.mp4');
    
    await ffmpeg.exec(ffmpegArgs);
    const data = ffmpeg.FS('readFile', 'output.mp4');
    
    self.postMessage({ 
      type: 'RESULT', 
      requestId,
      payload: { blob: new Blob([data], { type: 'video/mp4' }) },
    }, [data.buffer]);
  }
  
  if (type === 'TERMINATE') {
    ffmpeg.exit();
    self.close();
  }
};
```

**Tests:**
```typescript
// src/__tests__/exportBatch.test.ts
- exportBatchService con 4 ratios → genera 4 MP4s válidos
- ZIP output contiene los 4 MP4s + subs + vo + manifest
- onProgress callback llamado con percent 0-100 por ratio
- abortSignal cancela jobs en proceso
- Tamaño total ZIP < 80 MB con compresión DEFLATE 6
```

---

### TAREA 3.4 — ShareLinkGenerator

**Archivo:** `src/services/shareLink.ts`

```typescript
export interface ShareLinkOptions {
  masterBlob: Blob;
  manifest?: any;
  expiresInHours: number;  // default 24
}

export interface ShareLinkOutput {
  url: string;          // blob URL (chrome/safari) o data URL
  expiresAt: number;    // timestamp
  qrCodeDataUrl: string; // base64 PNG del QR
  embedHtml: string;    // <iframe> o <video> tag
}

export async function generateShareLink(options: ShareLinkOptions): Promise<ShareLinkOutput> {
  const { masterBlob, expiresInHours = 24 } = options;
  
  // 1. Crear blob URL
  const blobUrl = URL.createObjectURL(masterBlob);
  
  // 2. Expiración: guardar timestamp en metadata
  const expiresAt = Date.now() + expiresInHours * 3600 * 1000;
  
  // Programar cleanup
  setTimeout(() => URL.revokeObjectURL(blobUrl), expiresInHours * 3600 * 1000);
  
  // 3. Generar QR code (biblioteca qrcode.js client-side)
  const qrCodeDataUrl = await QRCode.toDataURL(blobUrl, { width: 256, margin: 2 });
  
  // 4. Embed HTML
  const embedHtml = `<video src="${blobUrl}" controls width="100%" style="border-radius:12px"></video>`;
  
  return { url: blobUrl, expiresAt, qrCodeDataUrl, embedHtml };
}

export function formatShareLinkExpiry(expiresAt: number): string {
  const hours = Math.round((expiresAt - Date.now()) / 3600000);
  if (hours > 1) return `${hours}h`;
  return `${Math.round((expiresAt - Date.now()) / 60000)}min`;
}
```

**Tests:**
```typescript
// src/__tests__/shareLink.test.ts
- generateShareLink retorna blob URL válido + QR base64 + embed HTML
- formatShareLinkExpiry retorna "24h" para 24h expiry
- QR code dataURL empieza con "data:image/png;base64,"
- Embed HTML contiene <video> tag con src apuntando al blob URL
```

---

### TAREA 3.5 — ExportCenter Redesign (4 Tabs)

**Archivos:**
- `src/components/generation/ExportCenter.tsx` (MOVIDO desde `src/components/export/`)
- `src/components/generation/ExportTabs/{Master,PackRRSS,Assets,Manifest,Share}.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Export Center                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  [ Master ] [ Pack RRSS ] [ Assets ] [ Manifest ] [ Share ]    │
│                                                                 │
│  Tab content here...                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Tabs individuales:**

```tsx
// Master Tab
function MasterTab() {
  return (
    <div>
      <h3>Video Principal (9:16)</h3>
      <video src={URL.createObjectURL(masterBlob)} controls className="rounded-xl" />
      <Button onClick={downloadMaster}>Descargar master.mp4</Button>
    </div>
  );
}

// Pack RRSS Tab
function PackRRSSTab() {
  const [options, setOptions] = useState<ExportPackOptions>(DEFAULT_OPTIONS);
  const [progress, setProgress] = useState<Record<AspectRatio, number>>({});
  const [generating, setGenerating] = useState(false);
  
  return (
    <div>
      <h3>Empaquetado Multi-Ratio para Redes Sociales</h3>
      <PresetSelector options={options} onChange={setOptions} />
      <SafeZonesPreview options={options} />
      <AdvancedOptions options={options} onChange={setOptions} />
      
      {generating ? (
        <ProgressBar progress={progress} />
      ) : (
        <Button onClick={async () => {
          setGenerating(true);
          const pack = await exportBatchService.batchEncode(masterBlob, options, brandPalette, setProgress);
          setGenerating(false);
          setPack(pack);
        }}>Generar Pack RRSS</Button>
      )}
      
      {pack?.zip && (
        <div>
          <p>✅ ZIP listo ({pack.zip.totalSizeMB} MB)</p>
          <Button onClick={() => downloadBlob(pack.zip.blob, pack.zip.filename)}>Descargar ZIP</Button>
        </div>
      )}
    </div>
  );
}

// Share Tab
function ShareTab() {
  const [shareLink, setShareLink] = useState<ShareLinkOutput | null>(null);
  
  return (
    <div>
      <h3>Compartir Video</h3>
      <input value={shareLink?.url ?? ''} readOnly />
      <Button onClick={() => copyToClipboard(shareLink?.url)}>Copiar Link</Button>
      {shareLink?.qrCodeDataUrl && <img src={shareLink.qrCodeDataUrl} alt="QR" />}
      <div>
        <code>{shareLink?.embedHtml}</code>
      </div>
    </div>
  );
}
```

**Tests:**
```typescript
// src/__tests__/ExportCenter.test.tsx (con @testing-library/react)
- Renderiza con 5 tabs visibles
- Click PackRRSS tab → muestra SafeZonesPreview + PresetSelector
- Click Share tab → input con blob URL + botón "Copiar Link"
- Click Master tab → <video> element renderizado con masterBlob
```

---

### TAREA 3.6 — ZIP Packaging con JSZip

**Instalar:** `pnpm add jszip @types/jszip`

```typescript
// src/services/zipHelper.ts
import JSZip from 'jszip';

export async function buildExportPackZip(pack: Partial<ExportPackOutput>): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();
  const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  
  pack.videos?.forEach(v => zip.file(v.filename, v.blob));
  if (pack.subtitles) zip.file(pack.subtitles.filename, pack.subtitles.srtBlob);
  if (pack.voAudio) zip.file(pack.voAudio.filename, pack.voAudio.wavBlob);
  if (pack.manifest) zip.file(pack.manifest.filename, pack.manifest.jsonBlob);
  
  // README dentro del ZIP
  zip.file('README.txt', 
`Bridge Creative Engine — Export Pack
Generated: ${new Date().toISOString()}
Total videos: ${pack.videos?.length ?? 0}
Total size: ${pack.zip?.totalSizeMB.toFixed(1) ?? 'N/A'} MB

Platforms:
${(pack.videos ?? []).map(v => `- ${v.aspectRatio}: ${v.filename} (${v.sizeMB.toFixed(1)} MB)`).join('\n')}

For support: https://github.com/your-org/bridge-creative-engine
`);
  
  const blob = await zip.generateAsync({ 
    type: 'blob', 
    compression: 'DEFLATE', 
    compressionOptions: { level: 6 } 
  });
  
  return { blob, filename: `bridge_pack_${now}.zip` };
}
```

---

### TAREAS 3.7 — 3.9 (Mejoras de auditoría S2)

**3.7 — Mover ExportCenter:**
```bash
mv src/components/export/ExportCenter.tsx src/components/generation/ExportCenter.tsx
# Actualizar import paths en tests
```

**3.8 — Fallback brand color (en `src/services/fallbackStrategy.ts`):**
```typescript
// Strategy "plain_color_with_text" ahora acepta brandKit
export async function generatePlainColorFallback(
  duration: number,
  text: string,
  brandColor?: string  // ← default '#0b0f19' (carbon) si no brand
): Promise<Blob> {
  const color = brandColor ?? '#0b0f19';
  // FFmpeg drawtext con color
  return ffmpegService.execute({
    command: 'staticColorWithText',
    input: null,
    options: { color, duration, text, fontColor: '#ffffff' },
  });
}
```

**3.9 — Telemetría `fallback_activated`:**
```typescript
// src/services/telemetry.ts (nuevo)
type TelemetryEvent = 
  | { type: 'fallback_activated'; jobId: string; reason: string; ratio: AspectRatio; timestamp: number }
  | { type: 'job_completed'; jobId: string; durationMs: number; timestamp: number }
  | { type: 'export_pack_generated'; ratios: AspectRatio[]; totalMB: number; timestamp: number };

class TelemetryService {
  private events: TelemetryEvent[] = [];
  
  record(event: TelemetryEvent): void {
    if (!this.isEnabled()) return;
    this.events.push(event);
    localStorage.setItem('bridge_telemetry', JSON.stringify(this.events.slice(-100))); // last 100
  }
  
  isEnabled(): boolean {
    return localStorage.getItem('bridge_telemetry_optin') === 'true';
  }
  
  setOptIn(enabled: boolean): void {
    localStorage.setItem('bridge_telemetry_optin', String(enabled));
    if (!enabled) {
      this.events = [];
      localStorage.removeItem('bridge_telemetry');
    }
  }
  
  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }
}

export const telemetry = new TelemetryService();

// Integración en fallbackStrategy.ts:
telemetry.record({
  type: 'fallback_activated',
  jobId: ...,
  reason: ...,
  ratio: ...,
  timestamp: Date.now(),
});
```

**UI Opt-in:** Banner discreto en Header (`Settings → Telemetry opt-in` checkbox).

---

## 🔧 INTEGRACIÓN CON CÓDIGO EXISTENTE

| Archivo S1/S2 | Cambio Requerido |
|---|---|
| `src/components/export/ExportCenter.tsx` | **MOVER** a `src/components/generation/ExportCenter.tsx` (3.7) |
| `src/services/fallbackStrategy.ts` | Aceptar `brandColor` en Strategy 2 (3.8) |
| `src/services/gemini/video.ts` | Emitir evento `fallback_activated` vía `telemetry.record` (3.9) |
| `src/components/common/Settings.tsx` (S1 Settings) | Añadir tab "Privacy" con opt-in telemetría (3.9) |
| `App.tsx` | Añadir header link "Telemetry opt-in" si no hay (3.9) |

---

## 🧪 PLAN DE TESTING INTEGRAL

### Unit Tests (Vitest, ≥80% coverage en nuevos archivos)

| Archivo | Tests Mínimos |
|---------|--------------|
| `exportPresets.test.ts` | 4 (list, get, estimateSize, estimateTime) |
| `exportBatch.test.ts` | 4 (4 ratios OK, abortSignal, ZIP contents, progress callback) |
| `shareLink.test.ts` | 3 (blob URL, QR data URL, expiry format) |
| `zipHelper.test.ts` | 2 (contains files, README) |
| `telemetry.test.ts` | 3 (opt-in, record, disable clears) |

### Integration Tests (Vitest + Testing Library)

| Test | Resultado Esperado |
|------|--------------------|
| `ExportCenter.test.tsx` | Renderiza 5 tabs, click PackRRSS muestra SafeZonePreview |
| `JobsPanel.test.tsx` | Integra con CostEstimatorModal (S2) — sin regresiones |

### Manual Acceptance Checklist (15 items)

Verificar tras implementación:

- [ ] Export Center muestra 5 tabs: Master, Pack RRSS, Assets, Manifest, Share
- [ ] Master tab muestra video player con master.mp4
- [ ] Click "Generar Pack RRSS" → progress visible por ratio
- [ ] ZIP descargado contiene 4 (o N) MP4s + subs.srt + vo.wav + manifest.json + README.txt
- [ ] Cada MP4 reproduce en VLC con aspect ratio correcto
- [ ] Safe zones overlay visibles cuando activado (barras rojas top/bottom)
- [ ] Subtítulos quemados correctamente (font/color/outline de marca)
- [ ] Watermark visible en bottom-right (si logo provisto)
- [ ] Share tab genera blob URL + QR code + embed HTML
- [ ] QR code escaneable con teléfono (apunta a master.mp4)
- [ ] Fallback Strategy 2 usa brand color (no negro por defecto)
- [ ] Telemetría: activar opt-in → ver eventos en localStorage
- [ ] ExportCenter.tsx ahora en `src/components/generation/` (no en `export/`)
- [ ] S1/S2 sin regresiones: 20 + 34 tests siguen pasando
- [ ] Build production: 4/4 validación verde, sin warnings nuevos

---

## 🚀 HANDOFF A SOFIA (resumido)

**Orden de implementación recomendado:**

1. **Fase 0** (10min): Instalar `pnpm add jszip @types/jszip` + mover `ExportCenter.tsx`
2. **Fase 1** (1h): `types/export.ts` + `services/exportPresets.ts` + tests
3. **Fase 2** (1h): `components/export/SafeZonePreview.tsx` (S3 visual)
4. **Fase 3** (1.5h): `services/exportBatch.ts` + `workers/exportBatch.worker.ts` (FFmpeg paralelizado)
5. **Fase 4** (30min): `services/zipHelper.ts` + `pnpm add jszip`
6. **Fase 5** (30min): `services/shareLink.ts` + `pnpm add qrcode @types/qrcode`
7. **Fase 6** (1h): `components/generation/ExportCenter.tsx` rediseñado con 5 tabs
8. **Fase 7** (30min): `services/telemetry.ts` + integración fallback + Settings Privacy
9. **Fase 8** (30min): Mover `ExportCenter.tsx` + actualizar imports + validar tests S1/S2 sin breaks

**Validaciones finales:**
- `pnpm typecheck && pnpm test --run && pnpm lint && pnpm build` — todos verde
- 20 S1 + 34 S2 + ~20 S3 nuevos = **~75 tests** esperados en verde
- Manual Acceptance 15 items — todos ✅

**Riesgos prevenidos:**
- NO romper S1/S2 (regression test obligatorio antes/depués)
- FFmpeg worker lifecycle (try/finally + terminate)
- ZIP memoria (zip.generateAsync con DEFLATE nivel 6 — ~80MB max input OK)
- ShareLink cleanup (`URL.revokeObjectURL` programado)

---

**Fin de SPEC-S3-EXPORT.md**  
*Listo para delegación a SOFIA*
