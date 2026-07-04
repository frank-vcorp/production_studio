# Handoff S6 — SOFIA Implementation (SPRINT FINAL)

**ID:** `IMPL-20260703-06`  
**Fecha:** 2026-07-04  
**De:** INTEGRA (Arquitecto)  
**A:** SOFIA (Constructora Principal)  
**CC:** GEMINI (Auditor Post-S6, sprint final)

---

## 🎯 OBJETIVO

Implementar **Sprint 6 — Tests + CI/CD + Docs + Observabilidad** según `context/SPECs/SPEC-S6-TESTS-CICD.md`. **ESTE ES EL ÚLTIMO SPRINT — v1.0 SHIP-READY**.

## Estado S1+S2+S3+S4+S5 Cerrado
- ✅ **181/181 tests** (20 S1 + 34 S2 + 35 S3 + 60 S4 + 32 S5) — **NO ROMPER ESTOS**
- ✅ **7/7 E2E tests** axe-core 0 violations
- ✅ **6 commits consecutivos**: `b14b251`, `87baf60`, `e663ae2`, `c64e6a9`, `5731c1e`, `d04fc27`
- ✅ **5/5 validaciones verde** consistente
- ✅ **H1 S5 audit fix** aplicado (useModalKeyboardShortcuts)
- ✅ **H1+H2 S4 audit fix** aplicados (ADR-04 gate + SmartConcat filtros)

## Spec Completa
Lee `context/SPECs/SPEC-S6-TESTS-CICD.md` — contiene:
- 6 tareas (6.1 a 6.6) con código de ejemplo, configs, docs templates
- Coverage thresholds, Playwright E2E specs completos, GitHub Actions workflow YAML
- Storybook stories examples, 5 docs .md templates completos
- Analytics service GDPR-safe

## Entregable Demostrable (Definition of Done)
1. `pnpm test:coverage` → **coverage ≥80%** en stores/services/hooks
2. `pnpm test:e2e` → **4 nuevos happy-path specs** passing (new user, sector template, batch, export)
3. `git push` → **GitHub Actions workflow** ejecuta 5 stages verde
4. `pnpm storybook` → **catálogo interactivo** con 10+ componentes documentados
5. `/docs` completo: README + ARCHITECTURE + PROMPT_ENGINEERING_GUIDE + TROUBLESHOOTING + API_REFERENCE
6. **Analytics opt-in** GDPR-safe en Settings → Privacy
7. Sin regresiones: 181 S1-S5 + 7 E2E tests anteriores intactos
8. **PROYECTO v1.0 SHIP-READY**

## Tareas (Orden Secuencial)

### Fase 0 — Setup (10min)
1. `pnpm add -D @vitest/coverage-v8 storybook @storybook/react-vite @storybook/addon-essentials`
2. **CRÍTICO**: `pnpm test --run` AHORA y confirma 181/181 pass. Si falla, **NO CONTINÚES** — escala a INTEGRA.

### Fase 1 — Coverage tests ≥80% (1h)
3. Configurar coverage thresholds en `vite.config.ts` (o `vitest.config.ts`):
   ```typescript
   test: {
     coverage: {
       provider: 'v8',
       thresholds: {
         lines: 80,
         functions: 80,
         branches: 70,
         statements: 80,
       },
     },
   }
   ```

4. Crear/Extender tests:
   - `src/__tests__/uiStore.test.ts` (NUEVO) — cubrir addToast, closePromptGate, openSplitView, resetAll, tour state
   - `src/__tests__/hooks/useJobs.test.ts` (NUEVO) — suscripción reactiva
   - `src/__tests__/hooks/useJobProgress.test.ts` (NUEVO) — batch ID edge cases
   - Extender `projectStore.test.ts` con `resetProject()`, `loadBrief()`
   - Extender `apiKeysStore.test.ts` con `checkProxy`

5. Ejecutar `pnpm test:coverage` y verificar thresholds verde. Si <80%, añadir más tests.

### Fase 2 — Playwright E2E happy-path specs (1h)
6. `tests/e2e/happy-path-new-user.spec.ts`:
   ```typescript
   test('new user can complete onboarding in under 5 minutes', async ({ page }) => {
     await page.goto('/');
     await page.click('text=Crear mi primer spot');
     // Wizard 3 pasos
     // Storyboard aparece
   });
   ```

7. `tests/e2e/happy-path-sector-template.spec.ts`:
   - Click sector automotriz → 3 servicios pre-llenados

8. `tests/e2e/happy-path-batch-generation.spec.ts`:
   - Setup brief mock + 6 transitions approved
   - Click Generar Lote → JobsPanel visible → ≥1 job done en 30s

9. `tests/e2e/happy-path-export.spec.ts`:
   - Setup masterVideo mock
   - Click Pack RRSS tab → 4 ratios checkboxes → Generar → ZIP download

10. Ejecutar `pnpm test:e2e` y verificar 4 nuevos specs verde (sin romper los 7 S5).

### Fase 3 — GitHub Actions workflow (1h)
11. `.github/workflows/ci.yml` — workflow completo:
    - typecheck ✅
    - lint ✅
    - test:coverage ✅
    - build ✅
    - E2E tests ✅ (needs test)
    - deploy-preview (needs both, only on PR)

12. NO agregar secrets al código. Workflow debe funcionar sin secrets (deploy fallaría pero tests pasan).

### Fase 4 — Storybook catalog (30min)
13. `pnpm dlx storybook@latest init` (genera `.storybook/`)
14. Crear 10+ stories en `src/stories/`:
    - `Button.stories.tsx`
    - `BriefWizard.stories.tsx`
    - `KeyframeStoryboard.stories.tsx`
    - `PromptApprovalGate.stories.tsx`
    - `CostEstimatorModal.stories.tsx`
    - `JobsPanel.stories.tsx`
    - `SplitViewEditor.stories.tsx`
    - `ExportCenter.stories.tsx`
    - `LandingPage.stories.tsx`
    - `useKeyboardShortcuts.stories.tsx` (o similar)

15. `pnpm storybook` levanta catálogo interactivo en localhost:6006.

### Fase 5 — Documentación completa (1h)
16. `docs/README.md` — quickstart, scripts, deploy (Vercel/Netlify), stack
17. `docs/ARCHITECTURE.md` — diagramas Mermaid (pipeline, keyframe chain, proxy, ffmpeg), ADRs, data flow, stores, workers, services
18. `docs/PROMPT_ENGINEERING_GUIDE.md` — cómo escribir intenciones humanas, estructura cámara, tonos por sector, ejemplos completos por sector
19. `docs/TROUBLESHOOTING.md` — errores Veo (quota/safety/timeout), FFmpeg (MEMFS/concat), IndexedDB (quota/blocked), memory leaks
20. `docs/API_REFERENCE.md` — types exportados, stores API, services API, hooks (useJobs, useJobProgress, useViewport, useFocusTrap, useModalKeyboardShortcuts, useKeyboardShortcuts), workers handlers

### Fase 6 — Analytics opt-in (30min)
21. `src/services/analytics.ts` — AnalyticsService GDPR-safe:
    ```typescript
    class AnalyticsService {
      isEnabled(): boolean;  // localStorage 'bridge_analytics_optin' === 'true'
      setOptIn(enabled: boolean): void;  // off limpia eventos
      record(event: AnalyticsEvent): void;  // cap 100 eventos
      getEvents(): AnalyticsEvent[];  // copia
    }
    ```
    Tipos: session_started, brief_completed, first_generation, export_completed, fallback_activated, session_ended (sin PII)

22. Integrar en:
    - `App.tsx`: session_started en mount
    - `projectStore.loadBrief()`: brief_completed
    - `jobQueue.completeJob()`: fallback_activated (si fallback)
    - `ExportCenter.assemblePack()`: export_completed

23. `Settings.tsx` → tab Privacy con toggle analytics

24. `src/__tests__/analytics.test.ts` (NUEVO) — 4 tests:
    - record sin opt-in: no guarda
    - record con opt-in: guarda en localStorage
    - cap 100 eventos
    - setOptIn(false) limpia eventos

### Fase 7 — Validaciones Finales (30min)
```bash
pnpm ci  # Pipeline completo: typecheck + lint + test:coverage + test:e2e + build
```
- 181 S1-S5 + ~15 S6 nuevos = **~200 tests** esperados
- Coverage ≥80% verde
- E2E happy-path 4 nuevos specs verde
- Manual Acceptance 12 items

## Validaciones Obligatorias Antes de Cerrar

```bash
pnpm typecheck 2>&1       # 0 errores TS
pnpm lint 2>&1            # 0 warnings
pnpm test:coverage 2>&1   # ≥80% lines, ≥70% branches
pnpm test:e2e 2>&1        # 7 S5 + 4 S6 = 11 specs passing
pnpm build 2>&1           # dist + ffmpeg-core (4 archivos)
pnpm storybook --ci 2>&1  # build catalog (verifica stories compilan)
```

**Y Manual Acceptance 12 items** del SPEC-S6 → todos ✅

## Self-Review Requerido (en Reporte Final — sustituto de qodo, está sunset)
1. ¿El código refleja la SPEC? (coverage, E2E, CI/CD, docs, storybook, analytics)
2. ¿Code smells evidentes? (coverage gaming, E2E flaky, docs vacías, analytics con PII)
3. ¿Tests cubren edge cases? (coverage con branches complejos, E2E con timeout)
4. ¿Riesgo de regresión? (181 tests S1-S5 deben seguir pasando)

## Reporte Final Esperado

```markdown
## SOFIA Terminó — S6 Tests + CI/CD + Docs + Observabilidad (FINAL)

### Resumen
- Implementadas 6 tareas (6.1 a 6.6) según SPEC-S6-TESTS-CICD.md
- Archivos nuevos: [lista]
- Archivos modificados (S1-S5): [lista — solo aditivos]
- Tiempo real: ~X horas

### Validaciones
- pnpm typecheck: ✅ 0 errores
- pnpm lint: ✅ 0 warnings
- pnpm test:coverage: ✅ XX% lines (≥80%), XX% branches (≥70%)
- pnpm test:e2e: ✅ XX/XX (7 S5 + 4 S6 = 11 specs)
- pnpm build: ✅ dist + ffmpeg-core
- pnpm storybook --ci: ✅ catalog compilado

### Manual Acceptance
- 12/12 items completados

### Self-Review
1. Spec compliance: ✅ [detalles]
2. Code smells: [lista menor si hay]
3. Test coverage: ✅ [edge cases]
4. Regression S1-S5: ✅ 181 + 7 E2E tests intactos

### 🏁 ESTADO DEL PROYECTO
**v1.0 SHIP-READY**
- Roadmap completo: S1 + S2 + S3 + S4 + S5 + S6 ✅
- 181 unit tests + 11 E2E tests
- 6 commits consecutivos trazables
- Docs completas en /docs
- CI/CD automatizado
- Analytics opt-in GDPR-safe
- Listo para deploy producción

### Sugerencia Final
> INTEGRA invoca a **GEMINI** (`subagent_type='gemini'`) como segunda mano antes de commit FINAL S6. qodo está sunset.
```

## Reglas Inquebrantables
- **NO rompas S1-S5** — los 181 tests + 7 E2E tests anteriores deben seguir pasando. Confirma ANTES y DESPUÉS.
- **NO commitees** — espera OK humano
- **NO pidas qodo** — sunset, usa self-review manual con 4 puntos
- **NO pegues logs inventados** — solo logs reales
- Si un enfoque falla 3 veces → escala

## Notas Críticas

1. **Coverage threshold**: 80% lines, 70% branches (más permisivo en branches por ifs de error handling).
2. **E2E specs**: usar `page.getByRole('button', { name: /crear mi primer/i })` semántico, NO selectores CSS frágiles.
3. **GitHub Actions secrets**: NO agregar al código. Workflow funciona sin secrets (deploy fallaría, tests pasan).
4. **Storybook**: `@storybook/react-vite` con Vite 5. Stories simples, no overload.
5. **Docs**: NO emojis decorativos (mantener tono técnico). Diagramas Mermaid en bloques ```mermaid.
6. **Analytics**: GDPR-safe, opt-in OFF por default, eventos sin PII (counts, sector, sizes).
7. **NO romper S1-S5**: Confirmar 181 tests + 7 E2E tests verde antes/después.
8. **CI local**: El script `pnpm ci` debe ejecutar pipeline completo en local antes de commit.

**Procede inmediatamente con Fase 0 (setup + verificar S1-S5 verde).**