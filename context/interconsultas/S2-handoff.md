# Handoff S2 — SOFIA Implementation

**ID:** `IMPL-20260703-02`  
**Fecha:** 2026-07-03  
**De:** INTEGRA (Arquitecto)  
**A:** SOFIA (Constructora Principal)  
**CC:** GEMINI (Auditor Post-S2)

---

## 🎯 OBJETIVO

Implementar **Sprint 2 — Robustez Veo + Background Jobs + Costos** completo según:
- `context/SPECs/SPEC-S2-ROBUSTNESS.md` (esta spec)
- `context/decisions/ARCH-20260703-{01..04}.md` (ADRs vinculantes —especialmente ADR-04 sobre approval gate)
- `PROYECTO.md` (backlog actualizado)
- `context/checkpoints/CHK_2026-07-03_S1.md` (estado S1 cerrado)

---

## 📁 ESTADO PREVIO VALIDADO (S1)

### ✅ 4/4 Logs en Verde
- `pnpm typecheck` → 0 errores TS
- `pnpm test --run` → 20/20 pass
- `pnpm lint` → 0 warnings
- `pnpm build` → `dist/` + `public/ffmpeg-core/` (4 archivos)

### ✅ H1 (GEMINI audit) Cerrado
- `parseSafetyFlags()` en `worker/src/index.ts` parsea `safetyRatings` y expone `X-Safety-Flags` header
- CORS helper actualizado con `Access-Control-Expose-Headers: X-Request-ID, X-Latency-Ms, X-Safety-Flags`
- Build sigue verde post-cambio

### ✅ Dependencias Funcionales para S2
- `src/services/gemini/client.ts` — backoff 1s/2s/4s (extender a 5 niveles)
- `src/services/gemini/video.ts` — tiene `generateTransition` (ampliar con retry)
- `src/workers/ffmpeg.worker.ts` — tiene `STATIC_FROM_IMAGE` (validar)
- `src/stores/projectStore.ts` — Zustand + IDB persist (extender con jobQueue slice)
- `src/stores/idbStorage.ts` — codec base64↔Blob (estable)

---

## 🚀 ORDEN DE IMPLEMENTACIÓN RECOMENDADO

### Fase 1 — Tipos y Servicios Core (1-1.5h)
```
1. Ampliar src/types/jobs.ts:
   - BackgroundJob, JobQueueState, JobSpec, JobKind, JobStatus
   - VeoError (code, retryable, attemptNumber, details)
   - CostBreakdown completo

2. src/services/costEstimator.ts:
   - PRICING_TABLE (veo $0.40, imagen3 $0.02, tts $0.001/s, llm $0.00125/1k)
   - estimateCost(), formatCost(), estimateETA()
   - PRICING_DISCLAIMER constante

3. src/services/gemini/video.ts (extender, no romper S1):
   - classifyVeoError(err): VeoError
   - RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000] (5 niveles)
   - generateTransitionWithRetry(transition, kfFrom, onAttempt): {blob, attempts, totalLatencyMs}
   - VERIFICAR que sigue exigiendo transition.status === 'approved' (ADR-04)
```

### Fase 2 — Jobs Queue + Worker (1.5-2h)
```
4. src/services/jobQueue.ts:
   - JobQueueService class
   - initialize(), createBatch(specs), pause(), resume(), cancel(), cancelAll(), clearCompleted()
   - subscribe(fn): unsubscribe
   - getQueueState()
   - private processNext() / executeJob() / persistJobs() / loadPersistedJobs()
   - parallelSlots = 3
   - Persistencia en IndexedDB store "jobs"

5. src/workers/job.worker.ts:
   - Web Worker dedicado
   - self.onmessage: recibe job, ejecuta según kind, postMessage resultado
   - Maneja video_generation con try/catch → si falla → fallbackStrategy
   - Maneja image_generation, tts (stubs pueden usar S1 services via dynamic import)

6. src/services/fallbackStrategy.ts:
   - generateFallbackVideo(transition, kfFrom, kfTo, reason): FallbackResult
   - Strategy 1: imagen estática + slow zoom (usa ffmpeg.staticVideoFromImage)
   - Strategy 2: plain color con texto (usa ffmpeg.staticColorWithText)
   - isRecoverableError(err): boolean
```

### Fase 3 — Notification + Service Worker (30min)
```
7. public/sw.js (raíz public, no src/):
   - notificationclick → focus existing tab o open
   - install/activate con skipWaiting/claim
   - NO lógica de fetch (es solo notification handler)

8. src/services/notification.ts:
   - requestNotificationPermission(): Promise<NotificationPermission>
   - showVideoReadyNotification(): void (title "🎬 Video listo", click → nav:export event)
   - registerServiceWorker(): Promise<SWRegistration | null>
   - Solo registrar SW si import.meta.env.PROD
```

### Fase 4 — UI Components (1-1.5h)
```
9. src/components/generation/CostEstimatorModal.tsx:
   - Modal fullscreen con tabla desglose + ETA + disclaimer
   - Botón [Confirmar y Generar] → llama jobQueue.createBatch + cierra modal + navega a JobsPanel
   - Icon shield-money (sky-400), Layout carbon-dark
   - Validar apiKeysStore antes de abrir

10. src/components/generation/JobsPanel.tsx + JobRow:
    - Header con progress bar (gradient sky→emerald)
    - 4 stat cards: ETA, Activos, Fallos, Tiempo Total
    - Lista de 6 jobs con icon-status, attempt count, latency, fallback indicator
    - Footer con [Cancelar Todo] [Limpiar Completados] [Ir a Export Center]
    - JobRow: StatusIcon según status, fallback border amber si fallbackUsed=true
    - Props onJumpToExport callback

11. src/hooks/useJobs.ts:
    - useEffect con jobQueue.subscribe
    - useState(getQueueState())
    - Cleanup: unsubscribe

12. Integración en ExportCenter.tsx:
    - Botón "Generar Lote Completo (6 clips)" → abre CostEstimatorModal
    - Al confirmar → jobs creados, muestra JobsPanel debajo
    - Al todos completados → enable ensamblar master
```

### Fase 5 — Tests (1h)
```
13. Unit tests nuevos:
    - src/__tests__/costEstimator.test.ts (4 tests)
    - src/__tests__/jobQueue.test.ts (5 tests)
    - src/__tests__/geminiVideo.test.ts (4 tests, retry + classify + safety)
    - src/__tests__/fallbackStrategy.test.ts (3 tests)
    - src/__tests__/notification.test.ts (3 tests)

14. Tests ampliados:
    - src/__tests__/projectStore.test.ts — añadir test setJobQueue
    - src/__tests__/geminiClient.test.ts — añadir test retry 5 niveles

15. E2E Playwright (tests/e2e/):
    - happy-path-batch.spec.ts
    - fallback.spec.ts
    - survive-refresh.spec.ts
    - cost-estimator.spec.ts
```

### Fase 6 — Polish + Validaciones (15min)
```
16. pnpm typecheck && pnpm test --run && pnpm lint && pnpm build
17. Manual Acceptance Checklist (15 items en SPEC-S2-ROBUSTNESS.md)
18. pnpm test:e2e (Playwright)
```

---

## ✅ VALIDACIONES OBLIGATORIAS ANTES DE CERRAR

```bash
pnpm typecheck 2>&1     # 0 errores TS
pnpm test --run 2>&1    # 20/20 S1 + nuevos S2 pass
pnpm lint 2>&1          # 0 warnings  
pnpm build 2>&1         # dist + ffmpeg-core
pnpm test:e2e 2>&1      # 4 specs pasan
```

**Y Manual Acceptance 15 items** del SPEC-S2-Robustness.md → todos ✅

---

## 🔍 SELF-REVIEW REQUERIDO (Incluir en Reporte Final)

1. ¿El código refleja la SPEC? (Sí/No + detalles)
2. ¿Code smells evidentes? (Worker lifecycle, retry logic, type safety)
3. ¿Tests cubren edge cases? (Retry 429, safety no-retry, hydration refresh, fallback chain)
4. ¿Riesgo de regresión? (Workers no limpiados, IDB quota, memory leaks con 6 clips Blob)

---

## 📤 FORMATO DE REPORTE FINAL

```markdown
## SOFIA Terminó — S2 Robustness

### Resumen
- Implementadas 6 tareas (2.1 a 2.6) según SPEC-S2-ROBUSTNESS.md
- Archivos nuevos: [lista]
- Archivos modificados (S1): [lista]
- Tiempo real: ~X horas

### Validaciones
- pnpm typecheck: ✅ 0 errores
- pnpm test --run: ✅ XX/XX pass (20 S1 + N nuevos S2)
- pnpm lint: ✅ 0 warnings
- pnpm build: ✅ dist + ffmpeg-core
- pnpm test:e2e: ✅ 4/4 specs

### Manual Acceptance
- 15/15 items completados

### Self-Review
1. Spec compliance: ✅ [detalles]
2. Code smells: [lista menor si hay]
3. Test coverage: ✅ [edge cases cubiertos]
4. Regression risks: [bajo/medio + mitigaciones]

### Archivos Clave
- src/services/jobQueue.ts — BackgroundJobQueue con IDB
- src/services/costEstimator.ts — Pricing hardcoded + ETA
- src/services/gemini/video.ts — generateTransitionWithRetry
- src/services/fallbackStrategy.ts — Jerarquía imagen→plain
- src/components/generation/JobsPanel.tsx — Per-clip UI
- src/workers/job.worker.ts — Worker dedicado

### Sugerencia
> INTEGRA invoca a **GEMINI** (`subagent_type='gemini'`) como segunda mano de validación antes de commit. qodo está sunset.
```

---

## ⚠️ NOTAS CRÍTICAS PARA SOFIA

1. **NO ROMPER S1**: Toda tarea debe ser aditiva. Si tocas un archivo S1 (geminiClient, ffmpeg), valida que los 20 tests S1 siguen pasando.

2. **Worker lifecycle**: SIEMPRE try/finally con `worker.terminate()`. Sin esto: memory leak garantizado.

3. **IDB migration**: Si añades store, incrementa versión en `openDB({ version: 2, upgrade })` con migración para usuarios existentes.

4. **Approval Gate**: En `generateTransitionWithRetry` VERIFICAR `transition.status === 'approved'` ANTES de cada intento (no solo al inicio). Mantener invariante de ADR-04.

5. **Notification permission**: Pedir permiso en Header banner discreto, NO al abrir CostEstimator (UX suave).

6. **ETA honesto**: Calcular con latencias reales de jobs completados, no hardcoded 180s. Si no hay completados: usar 180s default ± margen.

7. **Fallback transparency**: SIEMPRE amber border + icon + tooltip en JobRow cuando `fallbackUsed=true`. Usuario debe saber qué clips son fallback.

8. **Service Worker**: Solo `register` en `import.meta.env.PROD`. En dev, notification funciona sin SW (más simple).

9. **Testeo del Worker**: Tests de `jobQueue` deben mockear `Worker` (vitest mocks) para evitar spawn real.

10. **Memory budget**: 6 clips × ~50MB = 300MB en RAM. Recomienda al usuario cerrar otros tabs si memory < 1GB.

---

## 🎯 PRÓXIMO PASO TRAS S2

Al reportar S2 completado con validaciones verdes, INTEGRA:
1. Invoca a **GEMINI** (auditor) para revisión de robustez/UX
2. Genera **Checkpoint** `context/checkpoints/CHK_2026-07-03_S2.md`
3. Actualiza `PROYECTO.md` → S2 `[✓] Completado`, S3 `[~] En Progreso`
4. Crea `SPEC-S3-EXPORT.md` y handoff S3

---

**¿Dudas? Preguntar a INTEGRA antes de asumir.**  
**Regla:** Si un enfoque falla 3 veces → escalar a INTEGRA.

---

**Firma:** INTEGRA  
**Fecha:** 2026-07-03