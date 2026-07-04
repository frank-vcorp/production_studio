# SPEC-S1-FOUNDATION: Sprint 1 — Foundation + Security + First Happy Path

**ID:** `IMPL-20260703-01`  
**Fecha:** 2026-07-03  
**Estado:** `[~] En Progreso`  
**Duración Estimada:** 4-5 horas  
**Responsable:** SOFIA  
**Auditor:** GEMINI (Post-S1)  
**Handoff:** `context/interconsultas/S1-handoff.md`

---

## 🎯 ENTREGABLE DEMOSTRABLE (Definition of Done)

> **Usuario ve funcionando:**
> 1. `pnpm dev` → http://localhost:5173 carga UI carbon-dark idéntica a `estudio-creativo.html`
> 2. **Brief Wizard (3 pasos)**: Negocio → Fotos Clave → Estilo → Completa sin errores
> 3. **Keyframe Storyboard**: 6 slots fijos, sube Logo + 3 fotos reales → ve miniaturas + estados
> 4. **Genera 1 clip**: Click "Generar clip Atención" → Prompt Gate abre → ve 2 anclas + prompt editable → "Aprobar"
> 5. **Veo genera** clip (2-3 min) → preview inline en storyboard
> 6. **Ensambla Master**: Click "Ensamblar Master" → FFmpeg concat → descarga `master.mp4` 9:16 <30s
> 7. **Video reproduce** en VLC/QuickTime: bumper + atención + cta final (placeholders para resto)
> 8. **Recarga F5** → brief + keyframes + clips persisten en IndexedDB

---

## 📦 TAREAS TÉCNICAS (Checklist Verificable)

| # | Tarea | Archivos Principales | Verificación Automatizada |
|---|-------|---------------------|---------------------------|
| 1.1 | Vite + React + TS + Tailwind + deps base | `package.json`, `vite.config.ts`, `tsconfig.json` | `pnpm dev` levanta sin errores |
| 1.2 | Cloudflare Worker Proxy | `wrangler.toml`, `worker/src/index.ts` | `curl /api/gemini/generateContent` responde |
| 1.3 | Types completos | `src/types/*.ts` | `pnpm typecheck` → 0 errores |
| 1.4 | Store `projectStore` (Zustand + idb) | `src/stores/projectStore.ts` | F5 persiste estado completo |
| 1.5 | Store `apiKeysStore` (valida proxy) | `src/stores/apiKeysStore.ts` | Settings muestra "Conectado via Proxy" |
| 1.6 | `gemini/client.ts` (fetch + backoff) | `src/services/gemini/client.ts` | Unit test: retry en 429/5xx |
| 1.7 | `gemini/imageAnalysis.ts` (Vision) | `src/services/gemini/imageAnalysis.ts` | Foto → `VisualAnalysis` JSON válido |
| 1.8 | `gemini/keyframeGenerator.ts` (Imagen 3) | `src/services/gemini/keyframeGenerator.ts` | KF_IN + intención → KF_OUT |
| 1.9 | `promptBuilder.ts` (transitions + image3) | `src/services/promptBuilder.ts` | Incluye anclas + cámara + "NO INVENTES" |
| 1.10 | `BriefWizard.tsx` (3 pasos) | `src/components/brief/*.tsx` | Completa → `projectStore.brief` poblado |
| 1.11 | `KeyframeStoryboard.tsx` (6 slots) | `src/components/storyboard/*.tsx` | 4 fotos reales + 2 "Auto" visibles |
| 1.12 | `PromptApprovalGate.tsx` | `src/components/prompt/*.tsx` | Edita prompt → aprueba → callback |
| 1.13 | `gemini/video.ts` (Veo I2V + polling) | `src/services/gemini/video.ts` | Genera clip 4s → retorna `Blob` |
| 1.14 | `ffmpeg.ts` (WebWorker concat + subs + audio) | `src/services/ffmpeg.ts`, `workers/ffmpeg.worker.ts` | 3 clips + audio + subs → `master.mp4` |
| 1.15 | `ExportCenter.tsx` | `src/components/export/*.tsx` | `master.mp4` + `manifest.json` descargan |
| 1.16 | `vite.config.ts` (FFmpeg copy + env) | `vite.config.ts` | `pnpm build` → `dist/` sin errores |
| 1.17 | Scripts package.json | `package.json` | `pnpm typecheck` ✅ `pnpm build` ✅ |

---

## 🔧 ESPECIFICACIÓN DETALLADA POR TAREA

### 1.1 — Project Setup (Vite + React + TS + Tailwind)

```bash
# Comandos exactos
pnpm create vite@latest . -- --template react-ts
pnpm install
pnpm add -D tailwindcss@3.4 postcss autoprefixer
pnpm tailwindcss init -p
pnpm add zustand idb @ffmpeg/ffmpeg @ffmpeg/util
pnpm add -D vitest @vitest/ui playwright @playwright/test
pnpm add -D @types/node
```

**vite.config.ts (mínimo S1):**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  publicDir: 'public',
  build: {
    target: 'esnext',
    rollupOptions: { output: { manualChunks: { ffmpeg: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] } } }
  },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } } }, // Dev proxy a wrangler
  define: { 'import.meta.env.VITE_PROXY_BASE': JSON.stringify('/api/gemini') }
});
```

**tailwind.config.js:**
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        carbon: { bg: '#0b0f19', card: '#0f172a', border: '#1e293b' },
        sky: { 400: '#38bdf8', 500: '#0ea5e9' },
        emerald: { 400: '#34d399', 500: '#10b981' },
        fuchsia: { 400: '#e879f9', 500: '#d946ef' },
        rose: { 400: '#fb7185', 500: '#f43f5e' },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

**globals.css:** Copiar EXACTO de `estudio-creativo.html` líneas 9-49 (carbon-bg, neon-border, loader-ring, fonts).

---

### 1.2 — Cloudflare Worker Proxy

**Estructura:**
```
worker/
├── wrangler.toml
├── package.json
├── src/
│   └── index.ts
└── tsconfig.json
```

**wrangler.toml:** Usar especificación exacta de `ARCH-20260703-02`.

**Deploy:** `cd worker && pnpm install && wrangler deploy` → URL worker.

**Dev:** `wrangler dev --port 8787` (Vite proxy config apunta aquí).

---

### 1.3 — Types Completos (src/types/)

**Crear 5 archivos:**

1. **`brief.ts`** — `MasterBrief`, `BusinessIdentity`, `ServiceToAdvertise`, `GlobalAdVision`, `, `AidaStageDescription`
2. **`keyframe.ts`** — `Keyframe`, `VisualAnalysis`, `CameraSpec`, `KeyframeRole`
3. **`transition.ts`** — `KeyframeTransition`, `PromptVersion`, `TransitionStatus`
4. **`gemini.ts`** — Request/Response types: `GenerateContentRequest`, `GenerateVideoRequest`, `TTSRequest`, `VisionRequest`
5. **`project.ts`** — `ProjectState`, `BrandKit`, `ServicePack`, `ExecutableProject`, `ExportPack`, `SubtitleStyle`

**Regla:** Tipos estrictos, `readonly` donde aplique, discriminated unions para estados.

---

### 1.4 — projectStore (Zustand + idb)

**Archivo:** `src/stores/projectStore.ts`

**Requisitos:**
- `persist` middleware con `idbStorage` (IndexedDB real)
- `partialize` serializa: `brief`, `keyframes` (Map→Array), `transitions` (Map→Array), `clips` (Blob→base64), `manifest`, `jobQueue`
- `onRehydrateStorage` migra versiones (`PROJECT_STORE_VERSION = 1`)
- Actions mínimas S1:
  - `loadBrief(brief)`, `updateBusiness(partial)`, `addService()`, `updateServiceStage()`
  - `setKeyframe(kf)`, `uploadKeyframeImage(role, file)`, `analyzeKeyframe(id)`, `generateMissingKeyframes()`, `approveKeyframe(id)`
  - `buildTransition(from, to, node)`, `approveTransitionPrompt(id, prompt)`, `generateTransition(id)`
  - `startBatchGeneration()`, `assembleMaster()`, `saveSnapshot()`, `getHistory()`

---

### 1.5 — apiKeysStore (Solo Valida Proxy)

**Archivo:** `src/stores/apiKeysStore.ts`

```typescript
interface ApiKeysState {
  proxyConnected: boolean;
  checkProxy: () => Promise<void>;
  // NO guarda keys, solo valida que /health responde 200
}
```

---

### 1.6 — gemini/client.ts (Proxy Client)

**Archivo:** `src/services/gemini/client.ts`

**Clase `GeminiProxyClient`:**
- `baseUrl: import.meta.env.VITE_PROXY_BASE || '/api/gemini'`
- `request<T>({path, body, signal})` con timeout 180s, abort controller
- Métodos: `generateContent`, `generateVideo`, `pollOperation`, `generateImage`, `analyzeImage`, `synthesizeSpeech`
- Error class `GeminiProxyError` con `status`, `details`
- **Backoff exponencial**: 3 reintentos (1s, 2s, 4s) en 429/5xx/timeout

---

### 1.7 — gemini/imageAnalysis.ts (Vision)

**Archivo:** `src/services/gemini/imageAnalysis.ts`

**Función `analyzeImageForVeo(base64, mimeType): Promise<VisualAnalysis>`**
- Prompt exacto de `ARCH-20260703-04` (Vision Analysis Prompt)
- Model: `gemini-2.5-pro-vision`
- Config: `temperature: 0.1`, `responseMimeType: 'application/json'`
- Valida schema `VisualAnalysis` antes de retornar
- Cache opcional por hash de imagen (evita re-analizar)

---

### 1.8 — gemini/keyframeGenerator.ts (Imagen 3)

**Archivo:** `src/services/gemini/keyframeGenerator.ts`

**Función `generateMissingKeyframes(keyframes, brief, brandKit): Promise<Keyframe[]>`**
- Para cada nodo sin OUT: llama `generateKeyframeOut(kfIn, node, brief, brandKit)`
- `generateKeyframeOut`: construye prompt Imagen 3 (ver `ARCH-20260703-04`)
- Llama `client.generateImage({ prompt, referenceImage: kfIn.base64, aspectRatio: '9:16' })`
- Retorna `Keyframe` con `source: 'generated_imagen3'`, `generationPrompt`, `visualAnalysis` (auto-analiza resultado)

---

### 1.9 — promptBuilder.ts

**Archivo:** `src/services/promptBuilder.ts`

**Exports:**
- `buildKeyframeTransitionPrompt(from, to, node, camera, style, palette): string` — Prompt Veo I2V completo
- `buildImage3Prompt(kfIn, intent, node, style, palette): string` — Prompt Imagen 3 para OUT
- `buildTTSPrompt(voiceoverText, voice, tone): TTSPrompt` — Para TTS
- `formatVisualAnalysisForPrompt(va, label): string` — Formatea ancla para inyección en prompt
- `buildCameraMovement(cameraSpec, nodeKey): string` — Texto cámara desde spec

**Regla:** Todos los prompts incluyen bloque `⚠️ REGLA ABSOLUTA: USA LA IMAGEN DE REFERENCIA COMO BASE VISUAL INICIAL. NO INVENTES...`

---

### 1.10 — BriefWizard.tsx (3 Pasos)

**Archivos:** `src/components/brief/BriefWizard.tsx` + `StepBusiness.tsx` + `StepServices.tsx` + `StepVision.tsx` + `StepStages.tsx`

**Flujo:**
1. **StepBusiness**: Nombre, descripción, sector, audiencia, diferenciadores, logo upload
2. **StepServices**: Lista dinámica servicios (añadir/eliminar), cada uno: nombre, descripción, precio, beneficio
3. **StepVision**: Estilo global (textarea), música, pacing, tone keywords, avoid keywords
4. **StepStages**: Por servicio seleccionado, 4 textareas (Atención, Interés, Deseo, Acción) con placeholders guiados

**Validación:** No avanza si campos obligatorios vacíos. Auto-save a localStorage cada paso.

**Output:** `MasterBrief` completo → `projectStore.loadBrief(brief)` → llama `gemini/copy.ts` para `ExecutableProject` (stub S1, real S2).

---

### 1.11 — KeyframeStoryboard.tsx (6 Slots Fijos)

**Archivos:** `src/components/storyboard/KeyframeStoryboard.tsx` + `KeyframeSlot.tsx` + `TransitionArrow.tsx`

**Slots Fijos (orden inmutable):**
```typescript
const STORYBOARD_SLOTS = [
  { role: 'bumper_start', label: 'Logo', description: 'Logo PNG/SVG para cortinilla' },
  { role: 'atencion_in', label: 'Problema', description: 'Foto real: el problema que resuelves' },
  { role: 'interes_in', label: 'Taller', description: 'Foto real: tu espacio/equipo' },
  { role: 'deseo_in', label: 'Solución', description: 'Foto real: resultado final' },
  { role: 'accion_in', label: 'CTA Base', description: 'Foto fondo tarjeta final (opcional)' },
  { role: 'cta_final', label: 'CTA Final', description: 'Foto real: recepción/fachada' },
];
```

**KeyframeSlot Props:**
- `slot`, `keyframe`, `onUpload`, `onAnalyze`, `onGenerate`, `onApprove`, `onEditIntent`
- Estados visuales: `empty` (dropzone), `uploaded` (miniatura + badge "Real"), `analyzed` (badge "Analizada"), `generating` (spinner), `generated` (miniatura + badge "Auto" + botón "Aprobar"), `approved` (check verde)

**TransitionArrow:** Entre slots, muestra duración, estado, botón "Ver Prompt" si `prompt_ready`.

---

### 1.12 — PromptApprovalGate.tsx

**Archivo:** `src/components/prompt/PromptApprovalGate.tsx`

**Props:** Ver `ARCH-20260703-01` (componente completo especificado ahí).

**Features obligatorias:**
- Modal fullscreen z-50
- Header: nodo, duración, modelo
- Anclas visuales: 2 miniaturas lado a lado (FROM/TO) con análisis resumido
- Editor: textarea monospace 400px alto, syntax highlight básico (keywords: azul, anclas: verde, cámara: amarillo)
- Toolbar: "Mostrar diff", "Restaurar original", contador tokens/lines/chars
- Footer: "Cancelar" + "APROBAR Y GENERAR" (disabled si vacío o generando)
- Callback `onApprove(finalPrompt: string)`

---

### 1.13 — gemini/video.ts (Veo I2V)

**Archivo:** `src/services/gemini/video.ts`

**Funciones:**
- `generateTransition(transition, keyframeFrom): Promise<Blob>`
  - Construye request Veo: `{ prompt: transition.prompt, input_image: keyframeFrom.base64, fps: 24, duration: transition.duration }`
  - POST `/api/gemini/generateVideo` → `operationName`
  - Poll `/api/gemini/operations/{name}` cada 10s hasta `done: true`
  - Descarga video (base64 o URL) → convierte a `Blob`
  - Retorna `Blob` video/mp4
- `pollOperation(name): Promise<VideoOperation>` — wrapper polling con backoff

**Manejo errores:** Safety flags → UI warning. Quota 429 → retry 3x. Timeout 5 min → error.

---

### 1.14 — FFmpeg WASM (WebWorker + Service)

**Archivos:** `src/services/ffmpeg.ts` + `src/workers/ffmpeg.worker.ts`

**Worker (`ffmpeg.worker.ts`):** Implementación exacta de `ARCH-20260703-03`:
- `INIT` → `ffmpeg.load()`
- `CONCAT` → concat demuxer (stream copy)
- `BURN_SUBS` → force_style ASS con estilos marca
- `MIX_AUDIO` → VO + music ducking
- `SMART_CONCAT` → re-encode completo con LUT + color grading
- Transfer ownership de buffers (`postMessage(..., [buffer])`)

**Service (`ffmpeg.ts`):** Clase `FFmpegService` con API Promise:
- `init()`, `concatClips()`, `burnSubtitles()`, `mixAudio()`, `smartConcat()`, `exportMultiRatio()`
- Manejo `pending` Map por `requestId`
- Event `onProgress` para UI

---

### 1.15 — ExportCenter.tsx

**Archivo:** `src/components/export/ExportCenter.tsx`

**UI Mínima S1:**
- Botón "Ensamblar Master" → llama `projectStore.assembleMaster()`
- Progreso: "Concatenando..." → "Quemando subtítulos..." → "Mezclando audio..." → "Codificando..."
- Al terminar: muestra `master.mp4` en `<video controls>` + botones "Descargar MP4", "Descargar Manifest"
- `manifest.json` incluye: timeline, duraciones, prompts aprobados, hashes, timestamp

---

### 1.16 — Vite Config + FFmpeg Copy

**vite.config.ts** additions:
```typescript
import { copy } from 'vite-plugin-copy';

export default defineConfig({
  // ... existing
  plugins: [
    react(),
    copy({
      targets: [
        { srcDir: 'node_modules/@ffmpeg/core/dist', destDir: 'public/ffmpeg-core', rename: (name) => name }
      ],
      hook: 'build',
    })
  ],
});
```

---

### 1.17 — Scripts package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx",
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "worker:dev": "cd worker && wrangler dev --port 8787",
    "worker:deploy": "cd worker && wrangler deploy"
  }
}
```

---

## 🧪 PRUEBAS DE ACEPTACIÓN AUTOMATIZADAS (Vitest)

**Archivos:** `src/__tests__/*.test.ts`

| Test | Qué Verifica |
|------|--------------|
| `projectStore.persist.test.ts` | Save/load IndexedDB, F5 hidrata estado |
| `promptBuilder.test.ts` | Prompts incluyen anclas + "NO INVENTES" + cámara |
| `geminiClient.test.ts` | Backoff 3x en 429, timeout aborta, error parsing |
| `keyframeGenerator.test.ts` | Genera KF_OUT con source='generated_imagen3' |
| `ffmpegService.test.ts` | Init < 2s, concat 2 blobs → output válido |

**Comando:** `pnpm test` → todos pasan.

---

## 📋 CHECKLIST MANUAL PRE-ENTREGA (SOFIA → INTEGRA)

Antes de reportar S1 completo, SOFIA verifica:

- [ ] `pnpm dev` → UI carga, sin errores consola
- [ ] Brief Wizard: 3 pasos completan → `projectStore.brief` tiene datos
- [ ] Sube 4 fotos → KeyframeStoryboard muestra 4 miniaturas "Real" + 2 "Auto"
- [ ] Click "Analizar" en 1 foto → Vision Analysis completa → badge "Analizada"
- [ ] Click "Generar OUT" en nodo Atención → Imagen 3 genera → miniatura "Auto" + "Aprobar"
- [ ] Click "Generar clip Atención" → PromptGate abre → ve 2 anclas + prompt editable
- [ ] Edita prompt (cambia "dolly out" por "crane up") → "APROBAR Y GENERAR"
- [ ] Veo genera clip (espera 2-3 min) → preview aparece en storyboard
- [ ] Click "Ensamblar Master" → FFmpeg procesa → descarga `master.mp4`
- [ ] `master.mp4` reproduce en VLC: 9:16, <30s, bumper + atención + cta
- [ ] Recarga F5 → brief + keyframes + clip persisten
- [ ] `pnpm typecheck` → 0 errores
- [ ] `pnpm build` → `dist/` generado sin errores
- [ ] `pnpm test` → tests unitarios pasan

---

## 🚀 HANDOFF A SOFIA

**Archivo:** `context/interconsultas/S1-handoff.md`

```markdown
# Handoff S1 — SOFIA Implementation

## Contexto
Implementar Sprint 1 completo según SPEC-S1-FOUNDATION.md y ADRs 01-04.

## Archivos Base Existentes
- `estudio-creativo.html` (referencia UI/UX, copiar CSS exacto)
- `PROYECTO.md`, `context/00_ARQUITECTURA.md`, `context/decisions/ARCH-*.md`
- Esta SPEC

## Orden de Implementación Recomendado
1. Setup (1.1, 1.2, 1.16, 1.17) — Base compila
2. Types + Stores (1.3, 1.4, 1.5) — Estado funciona
3. Gemini Client + Services (1.6, 1.7, 1.8, 1.9, 1.13) — IA conectada
4. UI Components (1.10, 1.11, 1.12) — Flujo usuario
5. FFmpeg + Export (1.14, 1.15) — Video output
6. Tests + Polish — Calidad

## Validaciones Obligatorias Antes de Cerrar
1. `pnpm typecheck` — 0 errores
2. `pnpm test` — Unit tests pasan
3. `pnpm lint` — Sin warnings
4. Manual Acceptance Checklist (arriba) — Todo ✅

## Self-Review Requerido (Incluir en Reporte Final)
- ¿El código refleja la SPEC y ADRs?
- ¿Hay code smells evidentes?
- ¿Tests cubren edge cases listados?
- ¿Riesgo de regresión en stores/persistencia?

## Post-S1: GEMINI Auditoría
SOFIA debe sugerir que INTEGRA invoque a GEMINI como segunda mano de validación antes de commit.
```

---

## 📌 NOTAS PARA SOFIA

1. **CSS Exacto:** Copiar `estudio-creativo.html` líneas 9-49 a `globals.css` — carbon-bg, neon-border, loader-ring, fonts.
2. **Proxy Dev:** Vite `server.proxy` apunta a `wrangler dev --port 8787`. En prod, `/api/gemini/*` relativo.
3. **Blobs en Store:** Serializar como base64 en `partialize`, reconstruir `Blob` en `onRehydrateStorage`.
4. **FFmpeg Core:** `vite-plugin-copy` copia `@ffmpeg/core/dist` a `public/ffmpeg-core/` en build. En dev, servir desde `node_modules` via `public` symlink o config.
5. **Prompt Gates:** No generar NADA sin `onApprove`. Verificar en `generateTransition` que `transition.status === 'approved'`.
6. **Error Handling:** UI debe mostrar toasts/alertas claras, no fallar silenciosamente.
7. **Performance:** `React.memo` en slots, `useCallback` en handlers, lazy load FFmpeg worker.

---

**Fin de SPEC-S1-FOUNDATION.md**  
*Listo para delegación a SOFIA via `context/interconsultas/S1-handoff.md`*