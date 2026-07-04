# PROYECTO.md — Bridge Creative Engine (Standalone, Gemini-only)

**ID Proyecto:** `bridge-creative-engine`  
**Fecha Inicio:** 2026-07-03  
**Arquitecto:** INTEGRA (ARCH-20260703-01)  
**Estado General:** `[ ] Planificación` → `[~] En Progreso` → `[✓] Completado`

---

## 🎯 VISIÓN DEL PRODUCTO

Sistema **standalone, client-side only** para generar videos publicitarios 10-30s (AIDA) para RRSS (Reels, TikTok, Shorts, Feed) a partir de:
- Brief dinámico universal (negocio, servicios, visión global, 4 etapas AIDA)
- Keyframes reales del negocio (logo, fotos problema/espacio/solución/cta)
- Pipeline: Imagen 3 (keyframes) → Veo 3.1 I2V (transiciones keyframe→keyframe) → Gemini TTS → FFmpeg WASM (concat + burn subs + mix audio)
- **Control total humano**: Prompt Gates obligatorios, edición granular, trazabilidad completa

---

## 🗺️ ROADMAP — 6 MICRO-SPRINTS

| Sprint | ID | Estado | Entregable Demostrable | Duración |
|--------|-----|--------|------------------------|----------|
| **S1** | `IMPL-20260703-01` | `[✓] Completado` | Brief → 4 fotos → 1 clip Veo → master.mp4 descargable | 4-5h |
| **S2** | `IMPL-20260703-02` | `[✓] Completado` | Lote 6 clips background + cost estimator + survive refresh | 4-5h |
| **S3** | `IMPL-20260703-03` | `[✓] Completado` | Pack RRSS 4 ratios (9:16, 1:1, 4:5, 16:9) + safe zones | 4-5h |
| **S4** | `IMPL-20260703-04` | `[~] En Progreso` | Edición granular inline + Prompt Gate v2 + smart concat | 4-5h |
| **S5** | `IMPL-20260703-05` | `[✓] Completado` | Wizard guiado + templates sector + A11y AA + responsive | 4-5h |
| **S6** | `IMPL-20260703-06` | `[✓] Completado` | Tests 80% + CI/CD + Docs completas + analytics opt-in | 3-4h |

---

## 📋 BACKLOG DETALLADO POR SPRINT

### S1 — FOUNDATION + SECURITY + FIRST HAPPY PATH (`IMPL-20260703-01`)

| # | Tarea | Criterio de Aceptación | Estado |
|---|-------|------------------------|--------|
| 1.1 | Vite + React + TS + Tailwind + deps base | `pnpm dev` levanta sin errores | `[ ]` |
| 1.2 | Cloudflare Worker Proxy (`wrangler.toml`) | `POST /api/gemini/*` inyecta key server-side | `[ ]` |
| 1.3 | Types: `brief.ts`, `keyframe.ts`, `gemini.ts`, `project.ts`, `export.ts` | `pnpm typecheck` → 0 errores | `[ ]` |
| 1.4 | Store `projectStore` (Zustand + idb): brief, keyframes, transitions, clips, manifest | F5 persiste estado completo | `[ ]` |
| 1.5 | Store `apiKeysStore`: solo valida proxy (no guarda keys) | Settings muestra "Conectado via Proxy" | `[ ]` |
| 1.6 | `gemini/client.ts`: fetch + backoff 3x + error parsing | Unit test: retry en 429/5xx | `[ ]` |
| 1.7 | `gemini/imageAnalysis.ts`: Vision → `VisualAnalysis` JSON | Foto → análisis válido | `[ ]` |
| 1.8 | `gemini/keyframeGenerator.ts`: Imagen 3 para OUT automáticos | KF_IN + intención → KF_OUT | `[ ]` |
| 1.9 | `promptBuilder.ts`: transition + image3 prompts con anclas | Incluye "NO INVENTES" + cámara + estilo | `[ ]` |
| 1.10 | `BriefWizard.tsx`: 3 pasos (Negocio, Fotos, Estilo) + save localStorage | Completa → `projectStore.brief` poblado | `[ ]` |
| 1.11 | `KeyframeStoryboard.tsx`: 6 slots fijos, upload, miniatura, estado | 4 fotos reales + 2 "Auto" visibles | `[ ]` |
| 1.12 | `PromptApprovalGate.tsx`: textarea + anclas visuales + diff + aprobar | Edita → aprueba → callback prompt final | `[ ]` |
| 1.13 | `gemini/video.ts`: `generateTransition` (Veo I2V) + polling | Genera clip 4s → retorna `Blob` | `[ ]` |
| 1.14 | `ffmpeg.ts`: WebWorker concat + burn subs + mix audio | 3 clips + audio + subs → `master.mp4` | `[ ]` |
| 1.15 | `ExportCenter.tsx`: "Ensamblar Master" → descarga MP4 + Manifest | `master.mp4` + `manifest.json` en Descargas | `[ ]` |
| 1.16 | `vite.config.ts`: copy `@ffmpeg/core` + env prefix | `pnpm build` → `dist/` sin errores | `[ ]` |
| 1.17 | Scripts: `dev`, `build`, `typecheck`, `lint`, `test:unit` | `pnpm typecheck` ✅ `pnpm build` ✅ | `[ ]` |

**Definition of Done S1:**
- [ ] Usuario completa Brief Wizard guiado
- [ ] Sube Logo + 3 fotos reales (Problema, Taller, Solución, CTA Final)
- [ ] Ve Keyframe Storyboard con miniaturas
- [ ] Click "Generar clip Atención" → Prompt Gate → ve anclas + prompt editable → "Aprobar"
- [ ] Veo genera clip (2-3 min) → preview inline en storyboard
- [ ] Click "Ensamblar Master" → FFmpeg concat → descarga master.mp4 9:16 <30s
- [ ] Video se reproduce en VLC/QuickTime: bumper + atención + cta final
- [ ] Recarga F5 → brief + keyframes + clips persisten

---

### S2 — ROBUSTEZ VEO + BACKGROUND JOBS + COSTOS (`IMPL-20260703-02`)

| # | Tarea | Criterio de Aceptación | Estado |
|---|-------|------------------------|--------|
| 2.1 | `CostEstimator`: pricing hardcoded + cuota estimada | Modal muestra $ antes de generar | `[ ]` |
| 2.2 | `BackgroundJobQueue` (IndexedDB + SW): persist jobs, resume on load | Cierra/abre pestaña → job continúa | `[ ]` |
| 2.3 | `VeoClient` robusto: safety parsing, quota handling, backoff 5x | Test: mock 429 → retry → success | `[ ]` |
| 2.4 | `FallbackStrategy`: Veo fail → Imagen 3 frame intermedio → transición simple | Log muestra "Fallback activado" | `[ ]` |
| 2.5 | `GenerationMonitor`: per-clip progress, ETA real, pause/cancel, live preview | UI muestra progreso granular | `[ ]` |
| 2.6 | `NotificationAPI` + SW: "Video listo" al terminar background | Notificación nativa del navegador | `[ ]` |

**Definition of Done S2:**
- [ ] Click "Generar Lote Completo" → Modal Cost Estimator: "6 clips Veo: ~$3.00 | Total: ~$3.09"
- [ ] Background Job Queue inicia → cierra pestaña → reabre → Job sigue corriendo
- [ ] Panel Jobs: Clip 1/6 ✓, Clip 2/6 🔄 Generando... ETA 2m, Clip 3/6 ⏳
- [ ] Al terminar: Notificación "Video listo" + master.mp4 en Export Center
- [ ] Si Veo falla (safety/cuota): Reintento 3x → Fallback activado → Usuario notificado

---

### S3 — EXPORT MULTI-FORMATO + UX CRÍTICA (`IMPL-20260703-03`)

| # | Tarea | Criterio de Aceptación | Estado |
|---|-------|------------------------|--------|
| 3.1 | `ExportPresets`: 4 ratios con crop inteligente | 4 MP4s correctos aspect ratio | `[ ]` |
| 3.2 | `SafeZoneOverlay`: plantillas por plataforma | Visual check en preview | `[ ]` |
| 3.3 | `FFmpegBatchWorker`: 4 encodes paralelos con progreso | 4 videos en < 2 min | `[ ]` |
| 3.4 | `ShareLinkGenerator`: blob URL + expiración + QR | Link abre video en nueva pestaña | `[ ]` |
| 3.5 | `ExportCenter` redesign: tabs (Master, Pack, Assets, Manifest) | UX fluida, sin modales anidados | `[ ]` |

**Definition of Done S3:**
- [ ] Master generado → Export Center → "Generar Pack RRSS"
- [ ] Checkboxes: 9:16, 1:1, 4:5, 16:9 + Safe zones + Burn subs + Watermark
- [ ] Click "Generar 4 videos" → ZIP con 4 MP4s + subs.srt + manifest.json
- [ ] Botón "Compartir" → link firmado + QR code

---

### S4 — EDICIÓN GRANULAR INLINE + PROMPT GATE v2 (`IMPL-20260703-04`)

| # | Tarea | Criterio de Aceptación | Estado |
|---|-------|------------------------|--------|
| 4.1 | `SplitViewEditor`: resizable panels, keyboard shortcuts | Prompt izq + preview der | `[ ]` |
| 4.2 | `PromptEditor` v2: CodeMirror/Monaco lite + token counter + syntax highlight | Tokens coloreados, contador vivo | `[ ]` |
| 4.3 | `InlineNodeEditor`: VO, Subs, Intent, Camera en tabs inline | Edita sin perder contexto | `[ ]` |
| 4.4 | `VersionHistory` por transición: 5 últimos prompts + restore | Dropdown "Versión 3 de 5" | `[ ]` |
| 4.5 | `SmartConcat` FFmpeg: input mapping dinámico, solo re-encode cambiados | Master en < 15s tras 1 clip | `[ ]` |

**Definition of Done S4:**
- [ ] Click nodo "Deseo" → Split view: Izq Prompt Gate, Der Preview clip
- [ ] Edita VO inline → "Regenerar Audio" → 3s → preview actualizado
- [ ] Edita intención visual OUT → "Regenerar Visual" → 2 min → preview
- [ ] Prompt Gate v2: Syntax highlight, token counter "1,247/2,048", warning >1,800
- [ ] Diff inline: "Restaurar versión anterior" → dropdown 5 versiones
- [ ] FFmpeg Smart Concat: solo reemplaza clip 3 + audio 3 + subs 3 → master en 10s

---

### S5 — WIZARD GUIADO + TEMPLATES + ACCESIBILIDAD (`IMPL-20260703-05`)

| # | Tarea | Criterio de Aceptación | Estado |
|---|-------|------------------------|--------|
| 5.1 | `SectorTemplates`: JSON por sector con servicios, intenciones, prompts base | Selector carga template completo | `[ ]` |
| 5.2 | `GuidedTour`: Driver.js tooltips paso a paso | Usuario nuevo completa brief en < 5 min | `[ ]` |
| 5.3 | `A11yAudit`: axe-core en CI, ARIA labels, focus visible, landmarks | `pnpm test:a11y` → 0 violations | `[ ]` |
| 5.4 | `ResponsiveLayouts`: 3 breakpoints con Storybook stories | Visual check en 3 viewports | `[ ]` |
| 5.5 | `KeyboardNavigation`: Focus trap, skip links, shortcuts | Tab navega todo sin mouse | `[ ]` |

**Definition of Done S5:**
- [ ] Landing: "Crear mi primer spot" → Guided Tour (3 pasos)
- [ ] Selector sector: Automotriz, Estética, Comida, Salud, Inmobiliaria, Otro
- [ ] Template automotriz pre-llena servicios + intenciones ejemplo
- [ ] Brief Wizard: Auto-save, progreso visual, "Saltar y editar después"
- [ ] Keyboard nav completa + Screen reader (NVDA/VoiceOver) funcional
- [ ] Contraste AA verificado + Responsive 3 breakpoints

---

### S6 — TESTS + CI/CD + DOCS + OBSERVABILIDAD (`IMPL-20260703-06`)

| # | Tarea | Criterio de Aceptación | Estado |
|---|-------|------------------------|--------|
| 6.1 | `vitest` unit tests: stores, promptBuilder, costEstimator, ffmpeg utils | `pnpm test:unit` → >80% coverage | `[ ]` |
| 6.2 | `Playwright` E2E: happy path completo (brief→fotos→generar→export) | `pnpm test:e2e` → pass en CI | `[ ]` |
| 6.3 | `GitHub Actions` workflow: typecheck → lint → test → build → deploy preview | Badge verde en README | `[ ]` |
| 6.4 | `Storybook` components: PromptGate, KeyframeSlot, NodeEditor, ExportCenter | `pnpm storybook` levanta catálogo | `[ ]` |
| 6.5 | Documentación completa en `/docs` + `README` actualizado | Archivos .md existen y son útiles | `[ ]` |
| 6.6 | Analytics opt-in: events discretos sin PII | Consola muestra events | `[ ]` |

**Definition of Done S6:**
- [ ] Push a main → GitHub Actions: typecheck → lint → test → build → deploy preview
- [ ] Preview URL comentada en PR
- [ ] Docs: README, ARCHITECTURE, PROMPT_ENGINEERING_GUIDE, TROUBLESHOOTING, API_REFERENCE
- [ ] Analytics opt-in funcional

---

## 🔄 ESTADOS DE TAREAS

| Estado | Significado |
|--------|-------------|
| `[ ] Planificado` | En backlog, no iniciado |
| `[~] En Progreso` | Siendo implementado activamente |
| `[✓] Completado` | Implementado + validado + documentado |
| `[!] Bloqueado` | Espera dependencia externa o decisión |
| `[✗] Cancelado` | No se hará, razón documentada |

---

## 📝 CHECKPOINTS GENERADOS

| Checkpoint | Sprint | Fecha | Commit | Notas |
|------------|--------|-------|--------|-------|
| `CHK_2026-07-03_S1.md` | S1 ✅ | 2026-07-03 | `b14b251` | 17/17 tareas, 4 logs verde, 20/20 tests |
| `CHK_2026-07-03_S2.md` | S2 ✅ | 2026-07-03 | `87baf60` | 6/6 tareas, 4 logs verde, 54/54 tests |
| `CHK_2026-07-03_S3.md` | S3 ✅ | 2026-07-03 | `c64e6a9` | 9/9 tareas, 4 logs verde, 89/89 tests |
| `CHK_2026-07-04_S4.md` | S4 ✅ | 2026-07-04 | `5731c1e` | 7/7 tareas, 149/149 tests, H1+H2 fixes |
| `CHK_2026-07-04_S5.md` | S5 ✅ | 2026-07-04 | `d04fc27` | 6/6 tareas, 181/181 tests, 7/7 E2E a11y |
| `CHK_2026-07-04_S6.md` | S6 ✅ | 2026-07-04 | — | 6/6 tareas, 246/246 tests, 11/11 E2E, **85% coverage** |

---

## 📌 PRÓXIMA ACCIÓN

**🏁 PROYECTO CERRADO — v1.0 SHIP-READY**  
**Última tarea:** Commit final S6 + invocación GEMINI para auditoría final  
**Roadmap:** 6/6 sprints completados  
**Métricas:** 246 unit + 11 E2E + 85% coverage + 6 docs + 10 stories + CI/CD + analytics