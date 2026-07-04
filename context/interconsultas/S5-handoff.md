# Handoff S5 — SOFIA Implementation

**ID:** `IMPL-20260703-05`  
**Fecha:** 2026-07-04  
**De:** INTEGRA (Arquitecto)  
**A:** SOFIA (Constructora Principal)  
**CC:** GEMINI (Auditor Post-S5)

---

## 🎯 OBJETIVO

Implementar **Sprint 5 — Wizard Guiado + Templates + Accesibilidad** según `context/SPECs/SPEC-S5-WIZARD-A11Y.md`.

## Estado S1+S2+S3+S4 Cerrado
- ✅ **149/149 tests** (20 S1 + 34 S2 + 35 S3 + 60 S4) — **NO ROMPER ESTOS**
- ✅ **5 commits consecutivos**: `b14b251`, `87baf60`, `e663ae2`, `c64e6a9`, `5731c1e`
- ✅ **4/4 validaciones verde** consistente
- ✅ **H1+H2 audit S4 cerrados** (ADR-04 gate reforzado)

## Spec Completa
Lee `context/SPECs/SPEC-S5-WIZARD-A11Y.md` — contiene:
- 6 tareas (5.1 a 5.6) con código de ejemplo, tipos, tests, acceptance
- Templates data con 6 sectores (automotriz/estética/comida/salud/inmobiliaria/otro)
- Hooks (useGuidedTour, useViewport, useFocusTrap)
- E2E Playwright tests con axe-core

## Entregable Demostrable (Definition of Done)
1. **LandingPage** aparece si `!brief` con CTA "Crear mi primer spot"
2. **Guided Tour** activo: 3 tooltips (Negocio → Servicios → Estilo) en 30s
3. **Sector Templates**: 6 sectores con emojis + descripción + servicios típicos
4. Seleccionar "Automotriz" → Brief Wizard pre-llenado con 3 servicios típicos
5. **Storyboard accesible**: Cada nodo con `aria-label` + `role="button"` + Tab navigation
6. **Modales focus trap**: Prompt Gate, SplitView → Tab cicla dentro, Esc cierra
7. **Skip Link**: "Saltar al contenido principal" visible al primer Tab
8. **Responsive 3 breakpoints**: mobile <640, tablet 640-1023, desktop ≥1024
9. **axe-core en CI**: `pnpm test:a11y` → 0 violations
10. Sin regresiones: 149 tests anteriores intactos

## Tareas (Orden Secuencial)

### Fase 0 — Setup (10min)
1. `pnpm add driver.js @types/driver.js @axe-core/playwright`
2. Verificar S1-S4 verde con `pnpm test --run` (debe ser 149/149)

### Fase 1 — Sector Templates (1h)
3. `src/types/sector.ts` — `SectorId`, `SectorTemplate` interfaces
4. `src/data/sectorTemplates.ts` — 6 sectores con servicios típicos:
   - automotriz (3 servicios: Cambio aceite, Frenos, Pintura)
   - estetica (2-3 servicios: Corte, Coloración)
   - comida, salud, inmobiliaria (mínimo 2 servicios cada uno)
   - otro (vacíos para manual)
5. Tests: `src/__tests__/sectorTemplates.test.ts` (3 tests)

### Fase 2 — LandingPage + Guided Tour (1.5h)
6. `src/components/landing/LandingPage.tsx`:
   - Hero + subhero + 2 CTAs (Crear spot / Iniciar tour)
   - SectorTemplateGrid con 6 botones
7. `src/components/landing/GuidedTour.tsx` — wrapper Driver.js
8. `src/components/landing/SectorTemplateGrid.tsx` — grid de 6 sectores
9. Tests: `GuidedTour.test.tsx` (4 tests) + `LandingPage.test.tsx` (3 tests) + `SectorTemplateGrid.test.tsx` (3 tests)

### Fase 3 — Responsive Layout (1h)
10. `src/hooks/useViewport.ts` — hook con breakpoints
11. `src/styles/responsive.css` — CSS con @media (mobile/tablet/desktop)
12. Modificar `App.tsx` con clases responsive (`lg:grid-cols-12`, `md:`, etc.)
13. BottomNav para mobile
14. Tests: `useViewport.test.ts` (3 tests)

### Fase 4 — Keyboard Navigation + Focus Trap (1h)
15. `src/hooks/useFocusTrap.ts` — focus trap para modales
16. `src/components/common/SkipLink.tsx` — skip navigation
17. Integrar en `PromptApprovalGate` + `SplitViewEditor` con `role="dialog"` + `aria-modal`
18. Integrar `<SkipLink />` + landmarks (`<header role="banner">`, `<main id="main-content">`) en App
19. Añadir `*:focus-visible` outline en globals.css
20. Tests: `useFocusTrap.test.ts` (4 tests) + `SkipLink.test.tsx` (2 tests)

### Fase 5 — a11y Improvements en componentes existentes (1h)
21. `src/utils/a11y.ts` — helpers aria-label
22. Añadir `aria-label` + `role="button"` a nodos de KeyframeStoryboard
23. Añadir `aria-live="polite"` a JobsPanel (progreso)
24. Añadir `role="tablist"` / `role="tab"` / `aria-selected` a Tabs (S1)
25. `aria-label` en OnboardingResetButton
26. Tests: `a11y-helpers.test.ts` (3 tests)

### Fase 6 — Onboarding Reset Button (30min)
27. `src/components/landing/OnboardingResetButton.tsx`
28. Añadir `resetProject()` en projectStore
29. Añadir `resetAll()` en uiStore
30. Integrar en Header
31. Tests: `OnboardingResetButton.test.tsx` (3 tests)

### Fase 7 — E2E Playwright con axe-core (30min)
32. Configurar `tests/e2e/playwright.config.ts`
33. `pnpm exec playwright install` (descarga browsers)
34. `tests/e2e/a11y-landing.spec.ts`
35. `tests/e2e/a11y-brief-wizard.spec.ts`
36. `tests/e2e/a11y-storyboard.spec.ts`
37. `tests/e2e/keyboard-navigation.spec.ts`

### Fase 8 — Validaciones Finales (30min)
```bash
pnpm typecheck && pnpm test --run && pnpm lint && pnpm build && pnpm test:e2e
```
- 149 + ~23 S5 nuevos = **~172 tests** esperados
- Manual Acceptance 15 items

## Validaciones Obligatorias Antes de Cerrar

```bash
pnpm typecheck 2>&1     # 0 errores TS
pnpm test --run 2>&1    # ~172/172 pass (149 + ~23 S5)
pnpm lint 2>&1          # 0 warnings
pnpm build 2>&1         # dist + ffmpeg-core (4 archivos)
pnpm test:e2e 2>&1      # Playwright + axe-core 0 violations
```

**Y Manual Acceptance 15 items** del SPEC-S5 → todos ✅

## Self-Review Requerido (en Reporte Final — sustituto de qodo, está sunset)
1. ¿El código refleja la SPEC? (LandingPage, tour, templates, a11y, responsive, reset)
2. ¿Code smells evidentes? (Driver.js memory leaks, focus trap edge cases, ARIA redundante)
3. ¿Tests cubren edge cases? (mobile resize, focus trap con disabled, axe-core con elementos dinámicos)
4. ¿Riesgo de regresión? (149 tests S1-S4 deben seguir pasando)

## Reporte Final Esperado

```markdown
## SOFIA Terminó — S5 Wizard Guiado + Accesibilidad

### Resumen
- Implementadas 6 tareas (5.1 a 5.6) según SPEC-S5-WIZARD-A11Y.md
- Archivos nuevos: [lista]
- Archivos modificados (S1-S4): [lista — solo aditivos]
- Tiempo real: ~X horas

### Validaciones
- pnpm typecheck: ✅ 0 errores
- pnpm test --run: ✅ XX/XX pass (~172 estimados)
- pnpm lint: ✅ 0 warnings
- pnpm build: ✅ dist + ffmpeg-core
- pnpm test:e2e: ✅ axe-core 0 violations en 4 specs

### Manual Acceptance
- 15/15 items completados

### Self-Review
1. Spec compliance: ✅ [detalles]
2. Code smells: [lista menor si hay]
3. Test coverage: ✅ [edge cases cubiertos]
4. Regression S1-S4: ✅ 149 tests intactos

### Sugerencia
> INTEGRA invoca a **GEMINI** (`subagent_type='gemini'`) como segunda mano antes de commit. qodo está sunset.
```

## Reglas Inquebrantables
- **NO rompas S1-S4** — los 149 tests anteriores deben seguir pasando
- **NO commitees** — espera OK humano
- **NO pidas qodo** — sunset, usa self-review manual con 4 puntos
- **NO pegues logs inventados** — solo logs reales
- Si un enfoque falla 3 veces → escala

## Notas Críticas

1. **Driver.js**: API moderna con `.drive()`, no `.start()`. Importa CSS `driver.js/dist/driver.css`.
2. **axe-core**: import `import AxeBuilder from '@axe-core/playwright'`. Constructor `new AxeBuilder({ page })`.
3. **Focus visible**: Tailwind 3.4+ soporta `focus-visible:` variant. CSS global `*:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }`.
4. **ARIA live regions**: Para cambios dinámicos, usar `<div aria-live="polite" aria-atomic="true">`. NO `assertive` (interrumpe screen readers).
5. **Skip links**: SIEMPRE el primero elemento tabbable. `href="#main-content"` apunta al `<main id="main-content">`.
6. **Responsive breakpoints**: mobile <640, tablet 640-1023, desktop ≥1024. Usar Tailwind `sm:` `md:` `lg:`.
7. **NO romper S1-S4**: Confirmar 149 tests verde antes/después.
8. **Onboarding Reset**: NO destructivo irreversible. Confirm siempre con `window.confirm`.
9. **Playwright**: requiere `pnpm exec playwright install` para descargar browsers. Si falla, documentar.
10. **E2E tests**: Si environment no soporta Playwright (p.ej. sin browsers), documentar como deferred a S6.

**Procede inmediatamente con Fase 0 (setup + verificar S1-S4 verde).**