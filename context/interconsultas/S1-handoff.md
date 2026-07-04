# Handoff S1 — SOFIA Implementation

**ID:** `IMPL-20260703-01`  
**Fecha:** 2026-07-03  
**De:** INTEGRA (Arquitecto)  
**A:** SOFIA (Constructora Principal)  
**CC:** GEMINI (Auditor Post-S1)

---

## 🎯 OBJETIVO

Implementar **Sprint 1 — Foundation + Security + First Happy Path** completo según:
- `SPEC-S1-FOUNDATION.md` (esta carpeta)
- `ARCH-20260703-01` a `04` (ADRs en `context/decisions/`)
- `PROYECTO.md` (backlog y criterios de aceptación)

---

## 📁 ARCHIVOS BASE EXISTENTES (Referencia)

| Archivo | Qué Contiene | Uso |
|---------|--------------|-----|
| `estudio-creativo.html` | UI/UX actual, CSS custom (carbon-bg, neon-border, loader-ring), CLIENT_CONFIG | **Copiar CSS exacto a `globals.css`**, extraer lógica CLIENT_CONFIG a types |
| `PROYECTO.md` | Backlog, roadmap, criterios de aceptación S1 | Checklist de tareas y Definition of Done |
| `context/00_ARQUITECTURA.md` | Stack, diagramas, tipos, estructura carpetas | Guía de implementación |
| `context/decisions/ARCH-20260703-01.md` | ADR Principal: Keyframe Chain, Proxy, FFmpeg WASM | Decisiones vinculantes |
| `context/decisions/ARCH-20260703-02.md` | Proxy Cloudflare Worker spec | Implementar worker + client |
| `context/decisions/ARCH-20260703-03.md` | FFmpeg WASM WebWorker spec | Implementar worker + service |
| `context/decisions/ARCH-20260703-04.md` | Keyframe Chain anti-hallucination | Pipeline core |

---

## 🚀 ORDEN DE IMPLEMENTACIÓN RECOMENDADO

### Fase 1: Setup Base (1-1.5h)
```
1.1  pnpm create vite@latest . -- --template react-ts
1.2  Tailwind + PostCSS + Fuentes + CSS custom (globals.css)
1.3  Cloudflare Worker Proxy (worker/ + wrangler.toml + deploy)
1.16 vite.config.ts (FFmpeg copy, proxy dev, env)
1.17 package.json scripts
```
**Verificación:** `pnpm dev` levanta React+TS sin errores, `pnpm typecheck` 0 errores.

### Fase 2: Types + Stores (1h)
```
1.3  src/types/brief.ts, keyframe.ts, transition.ts, gemini.ts, project.ts, export.ts
1.4  src/stores/projectStore.ts (Zustand + idb persist)
1.5  src/stores/apiKeysStore.ts (valida proxy)
```
**Verificación:** `pnpm typecheck` 0 errores. F5 persiste estado dummy en IndexedDB.

### Fase 3: Gemini Client + Services (1-1.5h)
```
1.6  src/services/gemini/client.ts (ProxyClient + backoff)
1.7  src/services/gemini/imageAnalysis.ts (Vision → VisualAnalysis)
1.8  src/services/gemini/keyframeGenerator.ts (Imagen 3 OUTs)
1.9  src/services/promptBuilder.ts (transition + image3 + tts prompts)
1.13 src/services/gemini/video.ts (Veo I2V + polling)
```
**Verificación:** Unit tests pasan (`pnpm test`). Mock 429 → retry 3x → success.

### Fase 4: UI Components (1-1.5h)
```
1.10 src/components/brief/ (BriefWizard + 4 Steps)
1.11 src/components/storyboard/ (KeyframeStoryboard + KeyframeSlot + TransitionArrow)
1.12 src/components/prompt/ (PromptApprovalGate)
```
**Verificación:** Flujo manual: Brief Wizard → Storyboard 6 slots → Upload 4 fotos → Analiza → Genera OUT → Prompt Gate → Aprueba.

### Fase 5: FFmpeg + Export (1h)
```
1.14 src/services/ffmpeg.ts + workers/ffmpeg.worker.ts (INIT, CONCAT, BURN_SUBS, MIX_AUDIO, SMART_CONCAT)
1.15 src/components/export/ExportCenter.tsx
```
**Verificación:** 3 blobs dummy + audio dummy + subs dummy → `master.mp4` descargable y reproducible.

### Fase 6: Tests + Polish (30min)
```
- Vitest unit tests (stores, promptBuilder, client, keyframeGenerator, ffmpeg)
- pnpm typecheck, pnpm lint, pnpm test → todo verde
- Manual Acceptance Checklist (ver abajo)
```

---

## ✅ MANUAL ACCEPTANCE CHECKLIST (SOFIA DEBE VERIFICAR ANTES DE REPORTAR)

- [ ] `pnpm dev` → http://localhost:5173 carga UI carbon-dark sin errores consola
- [ ] **Brief Wizard**: 3 pasos (Negocio, Fotos, Estilo) completan → `projectStore.brief` poblado
- [ ] **Keyframe Storyboard**: 6 slots fijos, sube Logo + 3 fotos reales → ve 4 miniaturas "Real" + 2 "Auto"
- [ ] **Vision Analysis**: Click "Analizar" en foto → Gemini Vision completa → badge "Analizada" + análisis visible
- [ ] **Keyframe OUT Auto**: Click "Generar" en nodo Atención → Imagen 3 genera → miniatura "Auto" + botón "Aprobar"
- [ ] **Prompt Gate**: Click "Generar clip Atención" → Modal abre → ve 2 anclas (FROM/TO) + prompt editable monospace
- [ ] **Edita Prompt**: Cambia texto (ej. "dolly out" → "crane up") → "APROBAR Y GENERAR"
- [ ] **Veo Genera**: Espera 2-3 min → clip aparece en storyboard con preview `<video controls>`
- [ ] **Ensambla Master**: Click "Ensamblar Master" → FFmpeg concat + subs + audio → descarga `master.mp4`
- [ ] **Video Final**: `master.mp4` reproduce en VLC/QuickTime: 9:16, <30s, bumper + atención + cta final
- [ ] **Persistencia**: Recarga F5 → brief + keyframes + clip persisten en IndexedDB
- [ ] `pnpm typecheck` → 0 errores TypeScript
- [ ] `pnpm build` → `dist/` generado sin errores
- [ ] `pnpm test` → Tests unitarios pasan
- [ ] `pnpm lint` → Sin warnings

---

## 📋 VALIDACIONES OBLIGATORIAS ANTES DE CERRAR

1. **`pnpm typecheck`** — 0 errores TypeScript estrictos
2. **`pnpm test`** — Unit tests pasan (cobertura stores, promptBuilder, client, keyframeGenerator, ffmpeg)
3. **`pnpm lint`** — Sin warnings ESLint
4. **Manual Acceptance Checklist** — Todo ✅ (arriba)

---

## 🔍 SELF-REVIEW REQUERIDO (INCLUIR EN REPORTE FINAL)

Antes de reportar "S1 Completado", SOFIA debe incluir en su reporte:

1. **¿El código refleja la SPEC y ADRs?** (Sí/No + detalles)
2. **¿Hay code smells evidentes?** (Duplicación, acoplamiento, tipos `any`, etc.)
3. **¿Tests cubren edge cases listados?** (Retry 429, timeout abort, blob serialization, prompt validation)
4. **¿Riesgo de regresión?** (Stores persist, worker lifecycle, proxy auth, memory leaks)

---

## 📤 FORMATO DE REPORTE FINAL ESPERADO

```markdown
## SOFIA Terminó — S1 Foundation + Security + First Happy Path

### Resumen
- Implementadas 17 tareas según SPEC-S1-FOUNDATION.md
- Archivos creados/modificados: [lista]
- Tiempo real: ~X horas

### Validaciones
- pnpm typecheck: ✅ 0 errores
- pnpm test: ✅ XX/XX pasan
- pnpm lint: ✅ 0 warnings
- Manual Checklist: ✅ 15/15 completados

### Self-Review
1. Spec/ADR compliance: ✅ [detalles]
2. Code smells: [ninguno / lista menor]
3. Test coverage: [edge cases cubiertos]
4. Regression risks: [bajo/medio + mitigaciones]

### Archivos Clave
- `src/stores/projectStore.ts` — Zustand + idb persist
- `src/services/gemini/client.ts` — Proxy client + backoff
- `src/components/prompt/PromptApprovalGate.tsx` — Gate obligatorio
- `src/workers/ffmpeg.worker.ts` — FFmpeg WASM off main thread
- `worker/src/index.ts` — Cloudflare Worker proxy

### Próximos Riesgos Identificados
- [Si hay alguno]

### Sugerencia
> INTEGRA invoca a GEMINI como segunda mano de validación antes de commit.
```

---

## ⚠️ NOTAS CRÍTICAS PARA SOFIA

1. **CSS EXACTO:** Copiar `estudio-creativo.html` líneas 9-49 a `src/styles/globals.css` — `carbon-bg`, `neon-border`, `loader-ring`, `@import url('Plus Jakarta Sans')`. No inventar.

2. **Proxy Dev:** `vite.config.ts` → `server.proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } }`. Worker: `wrangler dev --port 8787`.

3. **Blobs en IndexedDB:** `partialize` serializa `Blob` → `base64`. `onRehydrateStorage` reconstruye `new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type })`.

4. **FFmpeg Core:** `vite-plugin-copy` copia `node_modules/@ffmpeg/core/dist` → `public/ffmpeg-core/`. En dev, `corePath: '/ffmpeg-core/ffmpeg-core.js'` funciona si carpeta existe en `public/`.

5. **Prompt Gates:** En `generateTransition()` **VERIFICAR** `transition.status === 'approved'` antes de llamar Veo. Lanzar Error si no.

6. **Error Handling UI:** Usar `uiStore.addToast({ type: 'error', message, duration: 5000 })` para errores Veo/Imagen/FFmpeg. No `alert()`.

7. **Performance:** `React.memo(KeyframeSlot)`, `useCallback` en handlers de storyboard, lazy load FFmpeg worker (`const worker = new Worker(new URL('../workers/ffmpeg.worker.ts', import.meta.url), { type: 'module' })`).

8. **No Hardcodear Keys:** Cliente **NUNCA** ve `GEMINI_API_KEY`. Todas las llamadas a `/api/gemini/*` relativo.

---

## 🎯 PRÓXIMO PASO TRAS S1

Al reportar S1 completado con validaciones verdes, INTEGRA:
1. Invoca a **GEMINI** (auditor) para revisión de calidad/infraestructura
2. Genera **Checkpoint** `context/checkpoints/CHK_2026-07-03_XXXX.md`
3. Actualiza `PROYECTO.md` → S1 `[✓] Completado`, S2 `[~] En Progreso`
4. Crea `SPEC-S2-ROBUSTNESS.md` y handoff S2

---

**¿Dudas? Preguntar a INTEGRA antes de asumir.**  
**Regla:** Si un enfoque falla 3 veces → escalar a INTEGRA.

---

**Firma:** INTEGRA  
**Fecha:** 2026-07-03