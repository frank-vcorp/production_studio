# GEMINI Audit — S1 Foundation + Security + First Happy Path

**ID:** `AUDIT-2026-07-03-S1`  
**Fecha:** 2026-07-03  
**Auditor:** GEMINI (calidad + infraestructura)  
**Sprint Auditado:** S1 — IMPL-20260703-01

---

## ✅ Garantías Cumplidas (8/8)

| # | Garantía | Archivo:Línea que lo Confirma |
|---|----------|-------------------------------|
| 1 | **API Keys nunca hardcodeadas, nunca en cliente** | `src/services/gemini/client.ts` (rutas relativas `/api/gemini/*`); `worker/src/index.ts:75` (inyecta key server-side en URL) |
| 2 | **Anti-Alucinación (Keyframe Chain)** | `src/services/promptBuilder.ts:11` (NO_INVENTE_RULE); `src/services/gemini/video.ts:30` (gate `status==='approved'`); `src/services/gemini/video.ts:45` (input_image I2V); `src/types/transition.ts:8` (topología fija `AidaNodeKey`) |
| 3 | **Prompt Approval Gates** | `src/components/prompt/PromptApprovalGate.tsx:57` (call `approveTransitionPrompt`); sin bypass posible |
| 4 | **Persistencia Offline-First** | `src/stores/projectStore.ts:431` (`partialize` excluye funciones); `:445` (Map→Array en `merge`); `:264` & `:470` (Blob ↔ base64) |
| 5 | **FFmpeg WASM lazy** | `src/workers/ffmpeg.worker.ts:81` (load único); `:140` (transferencia ArrayBuffer con ownership) |
| 6 | **Worker Proxy completo** | `worker/src/index.ts:194-212` (6 rutas); `:161-172` (rate limit 10 RPM/IP); `:18` (CORS lista blanca) |
| 7 | **Tests cubren garantías críticas** | `geminiClient.test.ts` (retry 429/500/timeout); `projectStore.test.ts` (gate); `idbStorage.test.ts` (roundtrip Blob); `storyboard.test.ts` (topología) |
| 8 | **Build Production** | `scripts/copy-ffmpeg-core.mjs` (maneja pnpm symlink quirk + recursión); 4 archivos en `public/ffmpeg-core/` |

---

## ⚠️ Hallazgos

### **H1 — [Bajo] — Worker Proxy no parsea Safety Ratings**

- **Archivo**: `worker/src/index.ts:88`
- **Problema**: El worker recibe la respuesta de Gemini, llama `res.text()` y la reenvía sin inspeccionar. El ADR-02 especificaba parsear `safetyRatings` del JSON y exponer el resultado en un header `X-Safety-Flags` para que el cliente tenga visibilidad inmediata de posibles bloqueos de contenido.
- **Recomendación**: Modificar `forwardToGemini` para usar `res.json()`, extraer `safetyRatings` del primer candidato, construir string resumen (ej. `HARASSMENT:HIGH,HATE:NONE`) y añadirlo como header `X-Safety-Flags`.

---

## 💡 Observaciones (No Bloqueantes)

| # | Observación | Acción Sugerida |
|---|-------------|-----------------|
| O1 | Rate limit en Worker es in-memory por instancia edge | Migrar a Cloudflare KV para producción real |
| O2 | `copy-ffmpeg-core.mjs` podría validar hash de integridad | Mejora menor, no bloqueante |

---

## ✅ Cumplimiento de ADRs

| ADR | Título | Estado |
|-----|--------|--------|
| ADR-01 | Stack principal (Zustand+IDB+React) | ✅ Cumplido |
| ADR-02 | Proxy Cloudflare (security + CORS + rate limit) | ⚠️ Cumplido parcialmente — falta H1 |
| ADR-03 | FFmpeg WASM en WebWorker | ✅ Cumplido |
| ADR-04 | Keyframe Chain anti-alucinación | ✅ Cumplido |

---

## 🎯 Veredicto Final

### **🟡 COMMIT CON SEGUIMIENTO**

- **Core de funcionalidad sólido y seguro**
- **1 hallazgo de severidad BAJA** a documentar para S2
- **No bloquea el commit** — se puede abrir issue de seguimiento

---

## 📌 Sugerencias Priorizadas para S2

| # | Sugerencia | Justificación |
|---|------------|---------------|
| 1 | **Implementar H1 (safety ratings parsing)** | Baja complejidad + alto valor para observabilidad del cliente |
| 2 | **Ampliar cobertura de tests** — añadir tests de integración completos (upload → generate) y tests de componentes React con `testing-library` (PromptApprovalGate) | Reduce regresiones en UI crítica |
| 3 | **Migrar rate limiter a Cloudflare KV** | Prepara escala más allá de prototipo |

---

**Firma:** GEMINI (auditor)  
**Próxima Acción:** INTEGRA presenta veredicto al usuario para decisión final de commit
