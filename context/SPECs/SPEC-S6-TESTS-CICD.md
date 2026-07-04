# SPEC-S6-TESTS-CICD: Sprint 6 — Tests + CI/CD + Docs + Observabilidad (FINAL)

**ID:** `IMPL-20260703-06`  
**Fecha:** 2026-07-04  
**Estado:** `[ ] Planificado` → `[~] En Progreso`  
**Dependencia:** S1 ✓ + S2 ✓ + S3 ✓ + S4 ✓ + S5 ✓ Completados  
**Duración Estimada:** 3-4 horas (sprint más corto, foco en consolidación)  
**Responsable:** SOFIA (delegación)  
**Auditor:** GEMINI (Post-S6, sprint final)  
**Handoff:** `context/interconsultas/S6-handoff.md`

---

## 🎯 ENTREGABLE DEMOSTRABLE (Definition of Done)

> **v1.0 ship-ready con CI/CD automatizado y docs completas:**
>
> 1. `pnpm test --coverage` → **coverage ≥80%** en stores/services/hooks
> 2. `pnpm test:e2e` → **4 happy-path specs** passing (nuevo usuario, sector template, generación batch, export)
> 3. `git push origin main` → **GitHub Actions** ejecuta workflow completo:
>    - typecheck ✅
>    - lint ✅
>    - unit tests ✅
>    - E2E tests ✅
>    - build ✅
>    - deploy preview → Vercel/Netlify → URL comentada en PR
> 4. `pnpm storybook` → catálogo interactivo con 10+ componentes documentados
> 5. `/docs` completo:
>    - `README.md` (quickstart, scripts, deploy)
>    - `ARCHITECTURE.md` (diagramas Mermaid, decisiones, data flow)
>    - `PROMPT_ENGINEERING_GUIDE.md` (cómo escribir intenciones, cámara, estilos, ejemplos por sector)
>    - `TROUBLESHOOTING.md` (errores Veo, cuotas, memoria, fallbacks, recuperaciones)
>    - `API_REFERENCE.md` (types, stores, services, hooks, workers)
> 6. Analytics opt-in: eventos discretos sin PII en `bridge_telemetry` localStorage

---

## 📋 BACKLOG DETALLADO DE TAREAS S6

| # | Tarea | Criterio de Aceptación | Esfuerzo |
|---|-------|------------------------|----------|
| **6.1** | Coverage tests ≥80% en stores/services/hooks | `pnpm test --coverage` muestra ≥80% en líneas | M |
| **6.2** | Playwright E2E happy-path specs | 4 specs cubren flujos críticos E2E | M |
| **6.3** | GitHub Actions workflow completo | Workflow ejecuta 5 stages, preview URL en PR | M |
| **6.4** | Storybook catalog (10+ componentes) | `pnpm storybook` levanta catálogo interactivo | L |
| **6.5** | Documentación completa en `/docs` (5 archivos .md) | 5 archivos .md útiles, linkados desde README | M |
| **6.6** | Analytics opt-in (GDPR-safe, sin PII) | Eventos discretos en localStorage + opt-in toggle | S |

**Esfuerzo:** S=1h, M=2h, L=3h | **Total:** 3-4h

---

## 📦 ESPECIFICACIÓN DETALLADA POR TAREA

### TAREA 6.1 — Coverage Tests ≥80%

**Configuración:**
- `vitest.config.ts` (o `vite.config.ts` ya lo tiene) — añadir `coverage` config:
  ```typescript
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/main.tsx', 'src/__tests__/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  }
  ```

**Tests adicionales para llegar al 80%:**
- `src/__tests__/projectStore.test.ts` (extender) — cubrir `resetProject()`, `loadBrief()`, todas las acciones nuevas
- `src/__tests__/uiStore.test.ts` (NUEVO) — cubrir `addToast`, `closePromptGate`, `openSplitView`, `resetAll`, tour state
- `src/__tests__/apiKeysStore.test.ts` (extender) — cubrir `checkProxy`, `safetyFlagsEnabled`
- `src/__tests__/idbStorage.test.ts` (ya existe) — extender para cubrir edge cases
- `src/__tests__/geminiClient.test.ts` (ya existe) — verificar backoff exponencial con jitter
- `src/__tests__/services/costEstimator.test.ts` (ya existe) — cubrir estimateETA edge cases
- `src/__tests__/services/fallbackStrategy.test.ts` (ya existe) — cubrir ambos strategies
- `src/__tests__/services/smartConcat.test.ts` (ya existe) — verificar reEncodedSegments
- `src/__tests__/services/shareLink.test.ts` (ya existe) — cubrir expiresInHours variants
- `src/__tests__/services/telemetry.test.ts` (ya existe) — cubrir setOptIn flow
- `src/__tests__/hooks/useJobs.test.ts` (NUEVO) — cubrir suscripción reactiva
- `src/__tests__/hooks/useJobProgress.test.ts` (NUEVO) — cubrir edge cases de batch ID

**Tests específicos para hooks críticos (Tarea 6.1 foco):**
```typescript
// src/__tests__/hooks/useJobs.test.ts
import { renderHook, act } from '@testing-library/react';
import { useJobs } from '@/hooks/useJobs';
import { jobQueue } from '@/services/jobQueue';

describe('useJobs', () => {
  it('subscribe to jobQueue state changes', () => {
    const { result } = renderHook(() => useJobs());
    expect(result.current.jobs).toEqual([]);
    expect(result.current.activeJobs.size).toBe(0);
  });
  
  it('unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useJobs());
    unmount();
    // jobQueue.subscribe should not include this listener
  });
  
  it('react to createBatch events', async () => {
    const { result } = renderHook(() => useJobs());
    const spec: JobSpec = { kind: 'video_generation', ... };
    await act(async () => {
      await jobQueue.createBatch([spec]);
    });
    expect(result.current.jobs.length).toBeGreaterThan(0);
  });
});
```

**Tests E2E (Tarea 6.2):**
```typescript
// tests/e2e/happy-path-new-user.spec.ts
import { test, expect } from '@playwright/test';

test('new user can complete onboarding in under 5 minutes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bridge Creative Engine');
  
  // Click "Iniciar tour guiado" → skip (ya conoce)
  // Click "Crear mi primer spot"
  await page.click('text=Crear mi primer spot');
  
  // Wizard Step 1: Negocio
  await page.fill('[data-testid="business-name"]', 'Mi Negocio Test');
  await page.click('text=Siguiente');
  
  // Wizard Step 2: Servicios
  await page.fill('[data-testid="service-name-0"]', 'Servicio A');
  await page.click('text=Siguiente');
  
  // Wizard Step 3: Visión Global
  await page.fill('[data-testid="vision-style"]', 'Estilo minimalista');
  await page.click('text=Completar');
  
  // Storyboard aparece
  await expect(page.locator('[data-testid="storyboard"]')).toBeVisible();
});
```

```typescript
// tests/e2e/happy-path-sector-template.spec.ts
test('selecting automotive template pre-fills 3 services', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="sector-automotriz"]');
  
  // Wizard Step 1 auto-filled
  await expect(page.locator('[data-testid="business-name"]')).toHaveValue(/taller|automotriz/i);
  
  // Wizard Step 2: 3 servicios pre-llenados
  await page.click('text=Siguiente');
  await expect(page.locator('[data-testid="service-name-0"]')).not.toBeEmpty();
  await expect(page.locator('[data-testid="service-name-1"]')).not.toBeEmpty();
  await expect(page.locator('[data-testid="service-name-2"]')).not.toBeEmpty();
});
```

```typescript
// tests/e2e/happy-path-batch-generation.spec.ts
test('user can generate batch and see progress', async ({ page }) => {
  await page.goto('/');
  // Setup: brief completo + 6 transiciones approved
  await page.evaluate(() => {
    const projectStore = window.__projectStore__;
    projectStore.loadBrief(/* mock brief */);
    // Approve 6 transitions
  });
  
  await page.click('text=Generar Lote');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.click('text=Confirmar');
  
  // JobsPanel visible
  await expect(page.locator('[data-testid="jobs-panel"]')).toBeVisible();
  
  // Al menos 1 job en estado 'done' o 'active' tras 30s
  await expect.poll(async () => {
    const count = await page.locator('[data-testid="job-done"]').count();
    return count;
  }, { timeout: 30000 }).toBeGreaterThan(0);
});
```

```typescript
// tests/e2e/happy-path-export.spec.ts
test('user can export multi-format pack', async ({ page }) => {
  await page.goto('/');
  // Setup: masterVideo existe en store
  await page.evaluate(() => {
    window.__projectStore__.setMasterVideo(/* mock blob */);
  });
  
  await page.click('[data-testid="export-tab-pack"]');
  await expect(page.getByRole('tab', { name: /pack rrss/i })).toBeVisible();
  
  // 4 ratios checkboxes
  await expect(page.locator('[data-testid="ratio-9x16"]')).toBeChecked();
  await expect(page.locator('[data-testid="ratio-1x1"]')).toBeChecked();
  
  // Click Generar Pack
  await page.click('text=Generar Pack RRSS');
  
  // ZIP descargable (esperar ~20s para 4 encodes paralelos)
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await downloadPromise;
});
```

**Scripts package.json:**
```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "storybook": "storybook dev -p 6006",
    "storybook:build": "storybook build",
    "ci": "pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm test:e2e && pnpm build"
  }
}
```

---

### TAREA 6.3 — GitHub Actions Workflow

**Archivo:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Typecheck
        run: pnpm typecheck
      
      - name: Lint
        run: pnpm lint
      
      - name: Unit tests with coverage
        run: pnpm test:coverage
        env:
          CI: true
      
      - name: Build
        run: pnpm build
      
      - name: Upload coverage to Codecov (optional)
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false
        continue-on-error: true

  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: test
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium
      
      - name: Build app
        run: pnpm build
      
      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          CI: true
      
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  deploy-preview:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [test, e2e]
    if: github.event_name == 'pull_request'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          github-comment: true
          github-status: true
```

**Nota:** Los secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` deben configurarse manualmente en GitHub repo settings. Si el usuario prefiere Netlify, ajustar el step.

---

### TAREA 6.4 — Storybook Catalog

**Dependencia:** `pnpm add -D storybook @storybook/react-vite @storybook/addon-essentials`

**Configuración:** `pnpm dlx storybook@latest init` genera `.storybook/`

**Stories a crear (10+):**

```
src/stories/
├── BrandPanel.stories.tsx           # (si existe, sino crear componente)
├── BriefWizard.stories.tsx          # Wizard con sector templates
├── KeyframeStoryboard.stories.tsx   # 6 nodos + estados
├── PromptApprovalGate.stories.tsx   # Modal con prompt editable
├── CostEstimatorModal.stories.tsx   # Modal de costos
├── JobsPanel.stories.tsx            # Panel con progress
├── SplitViewEditor.stories.tsx      # Editor split
├── ExportCenter.stories.tsx         # Tabs Master/Pack/Share
├── Button.stories.tsx               # Botón con variants
├── SkeletonLoader.stories.tsx       # Loading states
└── LandingPage.stories.tsx          # Sector grid
```

**Ejemplo story:**
```typescript
// src/stories/Button.stories.tsx
import type { Meta, StoryFn } from '@storybook/react';
import { Button } from '@/components/common/Button';

export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    icon: { control: 'text' },
    onClick: { action: 'clicked' },
  },
} as Meta<typeof Button>;

export const Primary: StoryFn<typeof Button> = (args) => <Button {...args}>Primary</Button>;
export const WithIcon: StoryFn<typeof Button> = (args) => (
  <Button {...args} icon="fa-bolt">Con Icono</Button>
);
```

---

### TAREA 6.5 — Documentación Completa

**5 archivos .md en `/docs`:**

#### `docs/README.md` (Quickstart + Deploy)
```markdown
# Bridge Creative Engine

Genera spots AIDA en minutos para Reels, TikTok, Shorts. 100% local.

## Quickstart
```bash
pnpm install
pnpm dev  # http://localhost:5173
```

## Scripts
| Script | Descripción |
|---|---|
| `pnpm dev` | Servidor dev con HMR |
| `pnpm build` | Build production + FFmpeg core copy |
| `pnpm preview` | Preview build local |
| `pnpm typecheck` | TS sin emit |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (vitest) |
| `pnpm test:coverage` | Unit tests + coverage |
| `pnpm test:e2e` | E2E tests (Playwright) |
| `pnpm storybook` | Storybook dev server |
| `pnpm worker:dev` | Cloudflare Worker local |
| `pnpm worker:deploy` | Deploy Worker |
| `pnpm ci` | Pipeline completo (typecheck + lint + test + e2e + build) |

## Deploy Producción

### Vercel (recomendado)
1. Conecta el repo a Vercel
2. Configura build command: `pnpm build`
3. Output directory: `dist`
4. Configura env vars: ninguno (Cloudflare Worker inyecta API key)
5. Deploy Cloudflare Worker: `pnpm worker:deploy` con `GEMINI_API_KEY` en secrets

### Netlify
Similar a Vercel, build command `pnpm build`, publish directory `dist`.

## Stack
- Vite 5 + React 18 + TypeScript 5
- Zustand + IndexedDB (offline-first)
- FFmpeg WASM (client-side video processing)
- Cloudflare Worker (API key proxy)
- Gemini API (Veo 3.1, Imagen 3, TTS)
```

#### `docs/ARCHITECTURE.md` (Diagramas + Decisiones)
```markdown
# Arquitectura

[Diagramas Mermaid: pipeline, keyframe chain, proxy, ffmpeg]

## Decisiones Arquitectónicas (ADRs)

| ADR | Título |
|---|---|
| ADR-01 | Standalone, Gemini-only, Keyframe Chain |
| ADR-02 | Proxy Cloudflare para API Keys |
| ADR-03 | FFmpeg WASM Client-Side |
| ADR-04 | Keyframe Chain Anti-Hallucination |

## Data Flow

```
Brief → Keyframe Chain → Prompt Builder → Veo I2V
                                    ↓
                          Imagen 3 (auto-OUT) → Vision Analysis
                                    ↓
                          Veo (transición KF→KF)
                                    ↓
                          TTS (voiceover) + VTT (subtitles)
                                    ↓
                          FFmpeg WASM: concat + burn subs + mix audio
                                    ↓
                          master.mp4 → Export Center (4 ratios)
                                    ↓
                          ZIP pack → Download / Share link / QR
```

## Stores (Zustand)

- `projectStore` — brief, keyframes, transitions, clips, masterVideo (persist IDB)
- `uiStore` — tabs, modals, toasts, tour state (localStorage)
- `apiKeysStore` — proxyConnected (valida /health)

## Workers

- `ffmpeg.worker.ts` — concat, burn subs, mix audio, smart concat, static image
- `job.worker.ts` — Veo con retry + fallback a Imagen 3

## Servicios

- `gemini/client.ts` — proxy client con backoff 1s/2s/4s/8s/16s
- `gemini/imageAnalysis.ts` — Vision → VisualAnalysis
- `gemini/keyframeGenerator.ts` — Imagen 3 para KF_OUT
- `gemini/video.ts` — Veo I2V + polling + classify errors
- `gemini/tts.ts` — Gemini TTS → PCM → WAV
- `costEstimator.ts` — pricing hardcoded
- `jobQueue.ts` — BackgroundJobQueue con IDB + parallelSlots=3
- `fallbackStrategy.ts` — imagen estática → plain color
- `smartConcat.ts` — SmartConcat FFmpeg con subs + audio opcionales
- `shareLink.ts` — blob URL + QR + embed
- `exportBatch.ts` — multi-ratio encode paralelo
- `telemetry.ts` — opt-in GDPR-safe
- `versionHistory.ts` — IDB store bridge-versions (max 5 por transición)
```

#### `docs/PROMPT_ENGINEERING_GUIDE.md` (Cómo escribir prompts efectivos)
```markdown
# Guía de Prompt Engineering

## Intenciones Humanas

La intención humana es tu **visión creativa** libre. Describe QUÉ quieres comunicar, no CÓMO filmarlo.

### ✅ Buenos ejemplos
- "Empezar mostrando el problema, luego abrir al taller"
- "Mostrar el aceite dorado fluyendo sobre motor limpio"
- "Cerrar con la tarjeta de contacto y el logo"

### ❌ Malos ejemplos (sobrecargados de técnica)
- "Steadicam dolly 35mm con aperture f/1.8..." (esto lo añade el prompt builder)
- "Luz natural con temperatura 5600K..." (esto también lo añade)

## Estructura de Cámara

El sistema añade automáticamente specs de cámara basados en el tipo de nodo:
- **Atención**: macro probe 120fps (impacto visual)
- **Interés**: steadicam dolly (recorrido del espacio)
- **Deseo**: macro close-up (transformación)
- **Acción**: static + zoom (CTA claro)

## Tonos por Sector

- **Automotriz**: confianza, rapidez, profesionalismo, honestidad
- **Estética**: belleza, autocuidado, transformación, bienestar
- **Comida**: apetito, sabor, tradición, satisfacción
- **Salud**: cuidado, profesionalismo, confianza, salud
- **Inmobiliaria**: aspiración, espacio, oportunidad, inversión

## Ejemplos Completos por Sector

### Automotriz — Cambio de aceite

**Atención**: "Primer plano de filtro viejo con aceite quemado en manos con grasa. Texto: '¿Cuándo cambiaste el aceite DE VERDAD?'"

**Interés**: "Recorrido por boxes limpios, pared de aceites ordenada con certificación ISO visible"

**Deseo**: "Aceite dorado nuevo fluyendo por motor limpio. Métrica visible: '15,000 km garantizado'"

**Acción**: "Tarjeta final con logo + WhatsApp + Maps + fondo del taller real"
```

#### `docs/TROUBLESHOOTING.md` (Errores comunes + soluciones)
```markdown
# Troubleshooting

## Errores Veo

### "quota exceeded" (429)
**Causa**: Cuota de Gemini agotada temporalmente.
**Solución**: El cliente retry automático con backoff 1s/2s/4s/8s/16s. Si tras 5 intentos falla, activa fallback (imagen estática + zoom). Aumentar cuota en Google Cloud Console.

### "safety blocked"
**Causa**: Gemini safety filter bloqueó el contenido.
**Solución**: NO retry (safety no es recuperable). El sistema activa fallback inmediatamente. Revisar el prompt — puede haber detectado contenido violento, sexual, etc.

### "timeout" (>5min)
**Causa**: Veo no completó la generación en 5 minutos.
**Solución**: Retry automático, luego fallback a Imagen 3 + video estático.

## Errores FFmpeg

### "MEMFS write failed"
**Causa**: Archivo >2GB no cabe en MEMFS.
**Solución**: Reducir duración del video o comprimir input.

### "concat failed"
**Causa**: Clips con codecs diferentes.
**Solución**: Forzar `-c:v libx264 -c:a aac` en todos los clips antes de concatenar.

## Errores IndexedDB

### "QuotaExceededError"
**Causa**: >1GB almacenado en IndexedDB.
**Solución**: Limpiar clips antiguos desde Settings → Clear Cache.

### "blocked" (transacción)
**Causa**: Otra tab tiene IDB abierto.
**Solución**: Cerrar otras tabs o recargar.

## Memory leaks

### RAM > 1GB
**Causa**: Workers no terminados.
**Solución**: Recargar página. Si persiste, reportar en issues con log.
```

#### `docs/API_REFERENCE.md` (Types + APIs)
```markdown
# API Reference

## Types

[Lista completa de tipos exportados]

## Stores

### useProjectStore
[API completa]

### useUIStore
[API completa]

### useApiKeysStore
[API completa]

## Services

[API de cada servicio]

## Hooks

- `useJobs()` — suscripción reactiva al job queue
- `useJobProgress()` — dispara notification cuando batch completa
- `useViewport()` — breakpoint mobile/tablet/desktop
- `useFocusTrap(active, containerRef)` — focus trap para modales
- `useModalKeyboardShortcuts({enabled, onClose})` — Esc handler
- `useKeyboardShortcuts(config, enabled)` — atajos completos

## Workers

### ffmpeg.worker.ts
Handlers: INIT, CONCAT, BURN_SUBS, MIX_AUDIO, SMART_CONCAT, EXPORT_RATIO, STATIC_FROM_IMAGE, TERMINATE
```

---

### TAREA 6.6 — Analytics Opt-in (GDPR-safe)

**Archivo:** `src/services/analytics.ts`

```typescript
export type AnalyticsEvent = 
  | { type: 'session_started'; sessionId: string; timestamp: number }
  | { type: 'brief_completed'; sector: SectorId; servicesCount: number; timestamp: number }
  | { type: 'first_generation'; nodeCount: number; timestamp: number }
  | { type: 'export_completed'; format: AspectRatio; sizeMB: number; timestamp: number }
  | { type: 'fallback_activated'; reason: string; ratio: string; timestamp: number }
  | { type: 'session_ended'; durationSec: number; timestamp: number };

class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  
  isEnabled(): boolean {
    return localStorage.getItem('bridge_analytics_optin') === 'true';
  }
  
  setOptIn(enabled: boolean): void {
    localStorage.setItem('bridge_analytics_optin', String(enabled));
    if (!enabled) {
      this.events = [];
      localStorage.removeItem('bridge_analytics_events');
    }
  }
  
  record(event: AnalyticsEvent): void {
    if (!this.isEnabled()) return;
    this.events.push(event);
    // Cap a últimos 100 eventos
    if (this.events.length > 100) this.events.shift();
    localStorage.setItem('bridge_analytics_events', JSON.stringify(this.events));
  }
  
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
}

export const analytics = new AnalyticsService();
```

**Integración:**
- `App.tsx`: en mount, `analytics.record({ type: 'session_started', sessionId: crypto.randomUUID(), timestamp: Date.now() })`
- `projectStore.loadBrief()`: `analytics.record({ type: 'brief_completed', sector, servicesCount, timestamp })`
- `jobQueue.completeJob()`: `analytics.record({ type: 'fallback_activated', reason, ratio, timestamp })` (si fallback)
- `ExportCenter.assemblePack()`: `analytics.record({ type: 'export_completed', format, sizeMB, timestamp })`

**UI Opt-in Toggle (Settings):**
```tsx
// En Settings modal, añadir tab "Privacy"
<PrivacySettings>
  <h3>Analítica anónima</h3>
  <p>Ayúdanos a mejorar compartiendo eventos anónimos. Nunca compartimos datos personales.</p>
  <Switch checked={analytics.isEnabled()} onChange={(v) => analytics.setOptIn(v)}>
    Compartir eventos anónimos
  </Switch>
</PrivacySettings>
```

**Tests:**
```typescript
// src/__tests__/analytics.test.ts
- record sin opt-in: no guarda evento
- record con opt-in: guarda en localStorage
- cap a 100 eventos
- setOptIn(false) limpia eventos
- getEvents retorna copia del array
```

---

## 🔧 INTEGRACIÓN CON CÓDIGO EXISTENTE

| Archivo | Cambio Requerido |
|---|---|
| `package.json` | Scripts: test:coverage, test:e2e, storybook, ci |
| `vite.config.ts` (o `vitest.config.ts`) | Coverage thresholds |
| `.github/workflows/ci.yml` (NUEVO) | Workflow completo |
| `docs/` (directorio NUEVO) | 5 archivos .md |
| `src/services/analytics.ts` (NUEVO) | AnalyticsService |
| `src/components/common/Settings.tsx` | Tab Privacy con analytics toggle |
| `src/stories/` (directorio NUEVO) | 10+ stories |
| `.storybook/` (NUEVO) | Config Storybook |

---

## 🧪 PLAN DE TESTING INTEGRAL

### Unit Tests (Vitest)
**Coverage target**: ≥80% lines, ≥70% branches

### E2E Tests (Playwright)
**4 nuevos happy-path specs**:
- `happy-path-new-user.spec.ts` (5min onb)
- `happy-path-sector-template.spec.ts` (3 services pre-fill)
- `happy-path-batch-generation.spec.ts` (generate + progress)
- `happy-path-export.spec.ts` (export pack ZIP)

### Storybook Visual
**10+ componentes** catalogados y navegables

### Manual Acceptance Checklist (12 items)

- [ ] `pnpm test:coverage` → ≥80% lines verde
- [ ] `pnpm test:e2e` → 4 happy-path specs passing
- [ ] `git push` (simulado) → GitHub Actions ejecuta 5 stages verde
- [ ] `pnpm storybook` → localhost:6006 con 10+ componentes
- [ ] `/docs/README.md` explica quickstart, scripts, deploy
- [ ] `/docs/ARCHITECTURE.md` tiene diagramas Mermaid + ADRs + data flow
- [ ] `/docs/PROMPT_ENGINEERING_GUIDE.md` tiene ejemplos por sector
- [ ] `/docs/TROUBLESHOOTING.md` cubre errores Veo/FFmpeg/IDB
- [ ] `/docs/API_REFERENCE.md` lista types + stores + services + hooks
- [ ] Settings → Privacy → toggle analytics funciona
- [ ] Analytics eventos en localStorage tras opt-in
- [ ] **CERO REGRESIONES S1-S5**: 181 + E2E tests verdes

---

## 🚀 HANDOFF A SOFIA (resumido)

**Orden de implementación:**

1. **Fase 0** (10min): Instalar `pnpm add -D @vitest/coverage-v8 storybook @storybook/react-vite @storybook/addon-essentials`
2. **Fase 1** (1h): Coverage config + tests adicionales para llegar al 80% (hooks nuevos: `useJobs`, `useJobProgress`)
3. **Fase 2** (1h): 4 E2E happy-path specs Playwright
4. **Fase 3** (1h): GitHub Actions workflow `.github/workflows/ci.yml`
5. **Fase 4** (30min): Storybook setup + 10 stories
6. **Fase 5** (1h): 5 docs archivos .md
7. **Fase 6** (30min): Analytics service + Settings Privacy tab + integration

**Validaciones finales:**
- `pnpm ci` ejecuta pipeline completo: typecheck + lint + test:coverage + test:e2e + build
- 181 S1-S5 + nuevos S6 = **~200 tests** esperados
- Coverage ≥80% verde

---

## 📌 NOTAS PARA SOFIA

1. **Coverage threshold**: 80% lines, 70% branches (más permisivo en branches por ifs de error handling).
2. **E2E specs**: usar `page.getByRole('button', { name: /crear mi primer/i })` semántico, NO selectores CSS.
3. **GitHub Actions**: secrets VERCEL_* deben configurarse manualmente (no en código). Workflow debe ser funcional sin secrets (solo deploy fallaría).
4. **Storybook**: usar `@storybook/react-vite` con Vite 5. Stories simples, no overload con interactividad compleja.
5. **Docs**: NO usar emojis decorativos (mantener tono técnico). Diagramas Mermaid en bloques ```mermaid.
6. **Analytics**: GDPR-safe, opt-in OFF por default, eventos sin PII (solo counts, sector, sizes).
7. **NO romper S1-S5**: 181 tests baseline deben seguir pasando. Confirmar antes y después.

---

**Fin de SPEC-S6-TESTS-CICD.md**  
*ÚLTIMO SPRINT — v1.0 ship-ready*