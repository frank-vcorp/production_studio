# SPEC-S5-WIZARD-A11Y: Sprint 5 — Wizard Guiado + Templates + Accesibilidad

**ID:** `IMPL-20260703-05`  
**Fecha:** 2026-07-04  
**Estado:** `[ ] Planificado` → `[~] En Progreso`  
**Dependencia:** S1 ✓ + S2 ✓ + S3 ✓ + S4 ✓ Completados  
**Duración Estimada:** 4-5 horas  
**Responsable:** SOFIA (delegación)  
**Auditor:** GEMINI (Post-S5)  
**Handoff:** `context/interconsultas/S5-handoff.md`

---

## 🎯 ENTREGABLE DEMOSTRABLE (Definition of Done)

> **Producto usable por cualquier persona, primera vez guiada:**
>
> 1. **Nuevo usuario** abre app → ve **LandingPage** con CTA "Crear mi primer spot"
> 2. **Guided Tour** activo: tooltip en Negocio → tooltip en Fotos → tooltip en Estilo (3 pasos, ~30s)
> 3. **Sector Templates**: Dropdown "Elige tu sector" con 6 opciones (Automotriz, Estética, Comida, Salud, Inmobiliaria, Otro)
> 4. **Selecciona "Automotriz"** → Brief Wizard pre-llenado con servicios típicos: "Cambio de aceite sintético", "Frenos y suspensión", "Pintura y enderezada"
> 5. **Usuario edita solo lo que quiere** → completa wizard en <5 min (vs S1 sin templates ~15 min)
> 6. **Storyboard accesible**: Cada nodo tiene `aria-label="Atención: filtro sucio en mano"`, `role="button"`, navegable con Tab
> 7. **Modales con focus trap**: Prompt Gate, SplitView, Settings — al abrir, Tab cicla solo dentro; al cerrar, foco vuelve al trigger
> 8. **Skip links**: "Saltar a contenido principal" oculto, visible al Tab inicial
> 9. **Responsive**: iPad 1024px → sidebar colapsable, iPhone 390px → stack vertical, sin overflow horizontal
> 10. **axe-core en CI**: `pnpm test:a11y` → 0 violations

---

## 📋 BACKLOG DETALLADO DE TAREAS S5

| # | Tarea | Criterio de Aceptación | Esfuerzo |
|---|-------|------------------------|----------|
| **5.1** | `LandingPage` con Guided Tour (Driver.js o custom) | 3 tooltips consecutivos, autocompletado en 30s | M |
| **5.2** | `Sector Templates` con 6 sectores + JSON pre-llenado | Dropdown carga servicios típicos del sector | M |
| **5.3** | `a11y` audit completo: ARIA labels, focus visible, landmarks, contrast AA | `pnpm test:a11y` con axe-core → 0 violations | L |
| **5.4** | Responsive layouts: 3 breakpoints + Storybook stories | iPad (1024) / Desktop (1280) / Mobile (390) sin overflow | M |
| **5.5** | Keyboard navigation: focus trap en modales + skip links | Tab navega todo, Esc cierra modal, Skip visible al Tab | M |
| **5.6** | Onboarding Reset (botón "Volver al inicio") en Header | Resetea todo el proyecto con confirmación | S |

**Esfuerzo:** S=1h, M=2h, L=3h | **Total:** 4-5h

---

## 🏗️ ARQUITECTURA DETALLADA

### Stack Nuevo (Additions)
- `pnpm add driver.js` — Guided tour library (~10KB gzipped)
- `pnpm add -D @axe-core/playwright` — A11y testing en Playwright
- `pnpm add -D @storybook/react-vite` — Storybook (opcional, S6 lo consolida)
- `pnpm add -D viewport-size-listener` — Custom hook para responsive

### Diagrama de Flujo Onboarding

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      FLUJO ONBOARDING S5                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Usuario abre app por 1ra vez]                                              │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │              LandingPage                                  │               │
│  │  ┌──────────────────────────────────────────────────┐    │               │
│  │  │  Hero: "Genera spots AIDA en minutos"           │    │               │
│  │  │  Subhero: "100% local. Tus datos nunca salen."  │    │               │
│  │  │  CTA: [Crear mi primer spot]                     │    │               │
│  │  └──────────────────────────────────────────────────┘    │               │
│  │                                                            │               │
│  │  ┌──────────────────────────────────────────────────┐    │               │
│  │  │  ¿Primera vez? [Iniciar tour guiado]            │    │               │
│  │  │   (3 tooltips en Negocio/Fotos/Estilo)         │    │               │
│  │  └──────────────────────────────────────────────────┘    │               │
│  │                                                            │               │
│  │  ┌──────────────────────────────────────────────────┐    │               │
│  │  │  Template picker: [Selecciona tu sector ▼]      │    │               │
│  │  │  → Automotriz: Cambio aceite, Frenos, Pintura   │    │               │
│  │  │  → Estética: Corte, Coloración, Tratamientos     │    │               │
│  │  │  → Comida: Platos fuertes, Postres, Bebidas      │    │               │
│  │  │  → Salud: Consultas, Análisis, Seguimiento       │    │               │
│  │  │  → Inmobiliaria: Venta, Alquiler, Tours         │    │               │
│  │  │  → Otro: Manual                                  │    │               │
│  │  └──────────────────────────────────────────────────┘    │               │
│  └──────────────────────────────────────────────────────────┘               │
│                                                                              │
│  Click "Crear mi primer spot" o seleccionar template →                       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │           BriefWizard v2 (pre-llenado por template)       │               │
│  │  Step 1: Negocio (campos básicos)                         │               │
│  │  Step 2: Servicios (lista pre-llenada por sector)         │               │
│  │  Step 3: Visión Global (textos + tone keywords)            │               │
│  │  Step 4: Etapas AIDA (4 textareas con placeholders)         │               │
│  │  [Saltar y editar después] [Siguiente] [Atrás]            │               │
│  └──────────────────────────────────────────────────────────┘               │
│                                                                              │
│  Completar wizard → Brief Wizard se cierra, abre Storyboard                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 ESPECIFICACIÓN DETALLADA POR TAREA

### TAREA 5.1 — LandingPage + Guided Tour

**Archivos nuevos:**
- `src/components/landing/LandingPage.tsx`
- `src/components/landing/GuidedTour.tsx`
- `src/stores/uiStore.ts` (extender con `hasSeenTour: boolean`, `startTour: () => void`, `endTour: () => void`)

**Dependencia:** `pnpm add driver.js @types/driver.js`

**LandingPage:**
```tsx
interface LandingPageProps {
  onCreateSpot: () => void;
  onStartTour: () => void;
  hasSeenTour: boolean;
}

export function LandingPage({ onCreateSpot, onStartTour, hasSeenTour }: LandingPageProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 carbon-bg">
      <header className="text-center max-w-3xl space-y-6">
        <h1 className="text-5xl font-extrabold text-white">
          Bridge Creative Engine
        </h1>
        <p className="text-xl text-slate-300">
          Genera spots AIDA en minutos para Reels, TikTok y Shorts.
        </p>
        <p className="text-sm text-slate-400">
          100% local. Tus datos nunca salen de tu navegador.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button
            variant="primary"
            size="lg"
            onClick={onCreateSpot}
            icon="fa-bolt"
          >
            Crear mi primer spot
          </Button>
          
          {!hasSeenTour && (
            <Button
              variant="secondary"
              size="lg"
              onClick={onStartTour}
              icon="fa-route"
            >
              Iniciar tour guiado
            </Button>
          )}
        </div>
      </header>
      
      {/* Sector templates preview */}
      <section className="mt-12 max-w-5xl w-full" aria-labelledby="templates-heading">
        <h2 id="templates-heading" className="text-2xl font-bold text-white text-center mb-6">
          O elige tu sector para empezar con plantillas
        </h2>
        <SectorTemplateGrid onSelect={(sector) => { onCreateSpot(); /* store.setSector(sector) */ }} />
      </section>
    </main>
  );
}
```

**GuidedTour** (con Driver.js):
```tsx
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function useGuidedTour(steps: TourStep[], onComplete: () => void) {
  const [driverInstance, setDriverInstance] = useState<Driver | null>(null);
  
  const start = useCallback(() => {
    const drv = driver({
      showProgress: true,
      animate: true,
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Atrás',
      doneBtnText: '¡Listo!',
      steps: steps.map(step => ({
        element: step.selector,
        popover: {
          title: step.title,
          description: step.description,
          position: step.position ?? 'auto',
        },
        onHighlightStarted: (el) => {
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      })),
      onDestroyed: () => {
        onComplete();
      },
    });
    drv.drive();
    setDriverInstance(drv);
  }, [steps, onComplete]);
  
  return { start, instance: driverInstance };
}

interface TourStep {
  selector: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}
```

**Tour predefinido** (3 pasos):
```typescript
export const WIZARD_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="brief-step-business"]',
    title: '1. Negocio',
    description: 'Empieza con datos básicos: nombre, descripción y sector. Esto contextualiza toda la generación.',
    position: 'bottom',
  },
  {
    selector: '[data-tour="brief-step-services"]',
    title: '2. Servicios',
    description: 'Selecciona los servicios a publicitar. Si elegiste un sector, ya hay plantillas pre-llenadas.',
    position: 'bottom',
  },
  {
    selector: '[data-tour="brief-step-vision"]',
    title: '3. Visión Global',
    description: 'Define el estilo y tono general. Esto se inyectará en todos los prompts visuales.',
    position: 'bottom',
  },
];
```

**Integración App.tsx:**
```tsx
function App() {
  const [showLanding, setShowLanding] = useState(!projectStore.brief);
  
  if (showLanding) {
    return (
      <LandingPage
        onCreateSpot={() => {
          uiStore.completeTour();
          setShowLanding(false);
        }}
        onStartTour={() => {
          // Después de cerrar Landing, abre wizard con tour activo
          uiStore.completeTour();
          uiStore.setShowTourOnNextRender(true);
          setShowLanding(false);
        }}
        hasSeenTour={uiStore.hasSeenTour}
      />
    );
  }
  
  return (
    <main>
      <Header />
      <Tabs />
      ...
    </main>
  );
}
```

**Tests:**
```typescript
// src/__tests__/GuidedTour.test.tsx
- Render sin tour activo no muestra popover
- start() llama Driver.js drive()
- onDestroyed llama onComplete
- Steps tienen selector, title, description, position

// src/__tests__/LandingPage.test.tsx
- Renderiza hero + CTA + sector grid
- Click "Crear mi primer spot" llama onCreateSpot
- Botón "Iniciar tour" solo si !hasSeenTour
```

---

### TAREA 5.2 — Sector Templates

**Archivos nuevos:**
- `src/data/sectorTemplates.ts`
- `src/components/landing/SectorTemplateGrid.tsx`
- `src/types/sector.ts`

**Tipos:**
```typescript
// src/types/sector.ts
export type SectorId = 'automotriz' | 'estetica' | 'comida' | 'salud' | 'inmobiliaria' | 'otro';

export interface SectorTemplate {
  id: SectorId;
  name: string;
  emoji: string;        // Para visual rápido
  description: string;
  defaultBusiness: Partial<BusinessIdentity>;
  defaultServices: ServiceToAdvertise[];
  defaultGlobalVision: Partial<GlobalAdVision>;
  defaultStages: Record<string, AidaStageDescription>; // key = serviceId
}
```

**Template data (6 sectores):**
```typescript
// src/data/sectorTemplates.ts
export const SECTOR_TEMPLATES: Record<SectorId, SectorTemplate> = {
  automotriz: {
    id: 'automotriz',
    name: 'Automotriz',
    emoji: '🚗',
    description: 'Taller mecánico, concesionario, refacciones',
    defaultBusiness: {
      sector: 'automotriz',
      targetAudience: 'Conductores que buscan servicio confiable y rápido',
      differentiators: ['Servicio rápido', 'Garantía escrita', 'Refacciones originales'],
    },
    defaultServices: [
      {
        id: 'svc_cambio_aceite',
        name: 'Cambio de Aceite Sintético',
        description: 'Aceite 5W-30, filtro OEM, revisión de niveles',
        priceReference: '$450 MXN',
        keyBenefit: 'Protección garantizada por 15,000 km',
        images: [],
      },
      {
        id: 'svc_frenos',
        name: 'Frenos y Suspensión',
        description: 'Balatas, discos, amortiguadores, alineación',
        priceReference: 'Desde $1,200 MXN',
        keyBenefit: 'Recuperá el control y la seguridad de tu auto',
        images: [],
      },
      {
        id: 'svc_pintura',
        name: 'Pintura y Enderezada',
        description: 'Pintura base agua, igualación de color, pulido',
        priceReference: 'Cotización por pieza',
        keyBenefit: 'Restauramos tu auto como recién salido de agencia',
        images: [],
      },
    ],
    defaultGlobalVision: {
      styleDescription: 'Documental industrial con luz natural y tonos azul/gris acero. Tomas limpias y directas.',
      musicMood: 'Confianza con ritmo mecánico al inicio, calmado al cierre',
      pacing: 'rapido',
      toneKeywords: ['confianza', 'rapidez', 'profesionalismo', 'honestidad'],
    },
    defaultStages: {
      svc_cambio_aceite: {
        atencion: 'Primer plano de filtro viejo con aceite quemado en manos. Texto: "¿Cuándo cambiaste el aceite DE VERDAD?"',
        interes: 'Recorrido por boxes limpios, pared de aceites ordenada con certificación ISO visible',
        deseo: 'Aceite dorado nuevo fluyendo por el motor. Métrica visible: "15,000 km garantizado"',
        accion: 'Tarjeta final con logo + WhatsApp + Maps + fondo del taller real',
      },
      // ... repetir por servicio
    },
  },
  estetica: {
    id: 'estetica',
    name: 'Estética y Belleza',
    emoji: '💇',
    description: 'Salón de belleza, spa, barbería',
    defaultBusiness: {
      sector: 'estetica',
      targetAudience: 'Personas que buscan transformación personal',
      differentiators: ['Productos premium', 'Profesionales certificados', 'Ambiente relajado'],
    },
    defaultServices: [
      {
        id: 'svc_corte',
        name: 'Corte y Peinado',
        description: 'Corte personalizado + peinado profesional',
        priceReference: 'Desde $350 MXN',
        keyBenefit: 'Encontrá el estilo que te define',
        images: [],
      },
      {
        id: 'svc_coloracion',
        name: 'Coloración y Mechas',
        description: 'Tonos balayage, mechas californianas, cubre canas',
        priceReference: 'Desde $800 MXN',
        keyBenefit: 'Color vibrante y duradero sin dañar tu cabello',
        images: [],
      },
    ],
    defaultGlobalVision: {
      styleDescription: 'Cálido, elegante, con luz dorada y tonos pastel. Tomas suaves, movimiento lento.',
      musicMood: 'Relajante y sofisticado, estilo chillout',
      pacing: 'medio',
      toneKeywords: ['belleza', 'autocuidado', 'transformación', 'bienestar'],
    },
    defaultStages: { /* ... */ },
  },
  comida: { /* ... */ },
  salud: { /* ... */ },
  inmobiliaria: { /* ... */ },
  otro: {
    id: 'otro',
    name: 'Otro (manual)',
    emoji: '📝',
    description: 'Ninguno de los anteriores — define manualmente',
    defaultBusiness: {},
    defaultServices: [],
    defaultGlobalVision: {},
    defaultStages: {},
  },
};
```

**Componente Selector:**
```tsx
function SectorTemplateGrid({ onSelect }: { onSelect: (sector: SectorId) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Object.values(SECTOR_TEMPLATES).map(template => (
        <button
          key={template.id}
          onClick={() => onSelect(template.id)}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-sky-500/50 transition-colors text-left"
          aria-label={`Seleccionar plantilla de ${template.name}`}
          data-tour={`sector-${template.id}`}
        >
          <div className="text-3xl mb-2" aria-hidden="true">{template.emoji}</div>
          <h3 className="text-sm font-bold text-white">{template.name}</h3>
          <p className="text-xs text-slate-400 mt-1">{template.description}</p>
        </button>
      ))}
    </div>
  );
}
```

**Integración con Wizard:**
```typescript
// En App.tsx o store selector
function applySectorTemplate(sector: SectorId) {
  const template = SECTOR_TEMPLATES[sector];
  const brief: MasterBrief = {
    ...emptyBrief,
    business: { ...emptyBusiness, ...template.defaultBusiness, sector: template.id },
    services: template.defaultServices,
    globalVision: { ...emptyGlobalVision, ...template.defaultGlobalVision },
    serviceStages: template.defaultStages,
  };
  projectStore.loadBrief(brief);
  setShowLanding(false);
}
```

**Tests:**
```typescript
// src/__tests__/sectorTemplates.test.ts
- SECTOR_TEMPLATES tiene los 6 sectores
- automotriz.defaultServices.length >= 3
- estetica.defaultGlobalVision.toneKeywords.length >= 3
- 'otro' tiene defaults vacíos (no rompe UI)

// src/__tests__/SectorTemplateGrid.test.tsx
- Renderiza 6 botones (uno por sector)
- Click automotriz → onSelect('automotriz')
- aria-label presente en cada botón
```

---

### TAREA 5.3 — Accesibilidad (a11y audit completo)

**Archivos nuevos:**
- `src/__tests__/a11y/playwright.test.ts` (E2E a11y con axe-core)
- `src/utils/a11y.ts` (helpers de ARIA labels)
- `tests/e2e/playwright.config.ts` (config Playwright)

**Dependencia:** `pnpm add -D @axe-core/playwright`

**Componentes a auditar (mínimo WCAG 2.1 AA):**

1. **LandingPage**: 
   - `<h1>` único en la página
   - Todos los botones tienen `aria-label` o texto visible
   - Contraste texto/fondo ≥ 4.5:1
   
2. **BriefWizard**: 
   - Cada input tiene `<label>` o `aria-label`
   - Errores con `aria-invalid` + `aria-describedby`
   - Steps anunciados con `aria-current="step"`
   
3. **KeyframeStoryboard**: 
   - Cada nodo es `role="button"` con `aria-label="Nodo X: descripción"`
   - Indicadores de estado con `aria-live="polite"` cuando cambian
   
4. **PromptApprovalGate / SplitViewEditor**: 
   - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
   - Focus trap (ver Tarea 5.5)
   - Esc cierra
   
5. **JobsPanel**:
   - `aria-live="polite"` cuando cambia progreso
   - `role="status"` para ETA
   
6. **Export Center**:
   - Tabs con `role="tablist"` / `role="tab"` / `aria-selected`
   - Cada tab panel con `role="tabpanel"` + `aria-labelledby`

**Playwright a11y test:**
```typescript
// src/__tests__/a11y/playwright.test.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility audits', () => {
  test('LandingPage passes axe-core', async ({ page }) => {
    await page.goto('/');
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
  
  test('BriefWizard with sector template passes axe-core', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-tour="sector-automotriz"]');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
  
  test('KeyframeStoryboard passes axe-core', async ({ page }) => {
    await page.goto('/storyboard');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
  
  test('PromptApprovalGate has focus trap + aria-modal', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-tour="approve-prompt"]');
    const modal = page.getByRole('dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    // Test focus trap: Tab should cycle within modal
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['TEXTAREA', 'BUTTON', 'INPUT']).toContain(focused);
  });
});
```

**Helper de ARIA labels:**
```typescript
// src/utils/a11y.ts
export function ariaLabelForService(service: ServiceToAdvertise): string {
  return `${service.name}: ${service.description.slice(0, 80)}`;
}

export function ariaLabelForTransition(transition: KeyframeTransition, nodeKey: string): string {
  return `Nodo ${nodeKey}, estado ${transition.status}`;
}

export function ariaLivePolitelyProps(): { 'aria-live': 'polite'; 'aria-atomic': boolean } {
  return { 'aria-live': 'polite', 'aria-atomic': true };
}
```

**Tests:**
```typescript
// src/__tests__/a11y-helpers.test.ts
- ariaLabelForService retorna "Nombre: descripción truncada"
- ariaLabelForTransition retorna "Nodo X, estado Y"
- ariaLivePolitelyProps retorna objeto correcto
```

---

### TAREA 5.4 — Responsive Layouts

**Archivos nuevos:**
- `src/hooks/useViewport.ts` (custom hook para breakpoint detection)
- `src/styles/responsive.css` (CSS con breakpoints)

**Hook:**
```typescript
// src/hooks/useViewport.ts
export type ViewportBreakpoint = 'mobile' | 'tablet' | 'desktop';

export interface ViewportInfo {
  breakpoint: ViewportBreakpoint;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useViewport(): ViewportInfo {
  const [width, setWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  
  const breakpoint: ViewportBreakpoint = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  
  return {
    breakpoint,
    width,
    height: window.innerHeight,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
  };
}
```

**CSS responsive:**
```css
/* src/styles/responsive.css */
@media (max-width: 639px) {
  /* Mobile: stack vertical, single column */
  .main-layout { @apply flex flex-col gap-3; }
  .left-panel, .right-panel { @apply w-full; }
  .tabs-container { @apply flex-wrap gap-1; }
  .split-view-container { @apply flex-col; }
}

@media (min-width: 640px) and (max-width: 1023px) {
  /* Tablet: sidebar colapsable, storyboard scroll horizontal */
  .main-layout { @apply grid grid-cols-12 gap-4; }
  .left-panel { @apply col-span-5; }
  .right-panel { @apply col-span-7; }
  .sidebar { @apply hidden; }
  .sidebar-toggle { @apply block; }
}

@media (min-width: 1024px) {
  /* Desktop: full layout */
  .main-layout { @apply grid grid-cols-12 gap-6; }
  .left-panel { @apply col-span-5; }
  .right-panel { @apply col-span-7; }
  .sidebar { @apply block; }
}
```

**Componentes Responsive:**
```tsx
// En App.tsx
function AppLayout() {
  const { isMobile, isTablet } = useViewport();
  
  return (
    <div className="main-layout">
      {(isDesktop || isTablet) && <Sidebar />}
      <LeftPanel />
      <RightPanel />
      {isMobile && <BottomNav />}
    </div>
  );
}
```

**Storybook stories (opcional):**
```typescript
// src/stories/Button.stories.tsx
import type { Meta, StoryFn } from '@storybook/react';

export default {
  title: 'Components/Button',
  component: Button,
} as Meta;

export const Primary: StoryFn = () => <Button variant="primary">Primary</Button>;
export const Secondary: StoryFn = () => <Button variant="secondary">Secondary</Button>;
export const Mobile: StoryFn = () => (
  <div style={{ width: 375, padding: 16 }}>
    <Button variant="primary">Mobile Primary</Button>
  </div>
);
```

**Tests:**
```typescript
// src/__tests__/useViewport.test.ts
- Inicializa con window.innerWidth actual
- Resize event actualiza width
- breakpoint retorna 'mobile' (< 640), 'tablet' (640-1023), 'desktop' (>= 1024)
```

---

### TAREA 5.5 — Keyboard Navigation + Focus Trap

**Archivos nuevos:**
- `src/hooks/useFocusTrap.ts` (custom hook para modales)
- `src/components/common/SkipLink.tsx` (skip navigation)

**Focus Trap:**
```typescript
// src/hooks/useFocusTrap.ts
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableSelector = 
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    
    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll(focusableSelector))
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
    
    const firstFocusable = getFocusable()[0];
    const lastFocusable = getFocusable()[getFocusable().length - 1];
    
    firstFocusable?.focus();
    
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    };
    
    container.addEventListener('keydown', handler);
    
    // Cleanup: restore focus to trigger element
    const triggerElement = document.activeElement as HTMLElement;
    return () => {
      container.removeEventListener('keydown', handler);
      triggerElement?.focus();
    };
  }, [active, containerRef]);
}
```

**SkipLink:**
```tsx
// src/components/common/SkipLink.tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-sky-500 focus:text-slate-950 focus:rounded-lg focus:font-bold"
    >
      Saltar al contenido principal
    </a>
  );
}
```

**Integración en PromptApprovalGate y SplitViewEditor:**
```tsx
function SplitViewEditor({ ... }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, containerRef);
  
  return (
    <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <h2 id="editor-title" className="sr-only">Editor granular de nodo</h2>
      {/* ... */}
    </div>
  );
}
```

**Integración en App.tsx (skip link + landmarks):**
```tsx
function App() {
  return (
    <>
      <SkipLink />
      <header role="banner">
        <Header />
      </header>
      
      <nav role="navigation" aria-label="Tabs principales">
        <Tabs />
      </nav>
      
      <main id="main-content" role="main">
        {/* Content */}
      </main>
      
      <footer role="contentinfo">
        <Footer />
      </footer>
    </>
  );
}
```

**Focus Visible CSS (Tailwind 3.4+):**
```css
/* globals.css */
*:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 2px;
}
```

**Tests:**
```typescript
// src/__tests__/useFocusTrap.test.ts
- Activa focus trap cuando active=true
- Tab desde último focusable va al primero
- Shift+Tab desde primero va al último
- Cleanup restaura foco al elemento trigger
- Disabled elements no se incluyen en focusables

// src/__tests__/SkipLink.test.tsx
- Renderiza con sr-only
- focus:not-sr-only la hace visible al focus
- href apunta a #main-content
```

---

### TAREA 5.6 — Onboarding Reset (botón "Volver al inicio")

**Archivo nuevo:**
- `src/components/landing/OnboardingResetButton.tsx`

**Componente:**
```tsx
function OnboardingResetButton() {
  const { addToast } = useUIStore();
  const reset = useProjectStore((s) => s.resetProject);
  
  const handleReset = () => {
    const confirmed = window.confirm(
      '¿Volver al inicio? Esto borrará tu brief actual y todas las keyframes generadas. ¿Continuar?'
    );
    if (!confirmed) return;
    
    reset();  // projectStore.resetProject() limpia todo
    uiStore.resetAll();  // uiStore.clearAll()
    localStorage.removeItem('bridge_telemetry_optin');
    addToast({ kind: 'info', message: 'Onboarding reiniciado. Bienvenido de nuevo.' });
  };
  
  return (
    <button
      onClick={handleReset}
      className="text-xs text-slate-500 hover:text-amber-400 transition-colors"
      aria-label="Volver al inicio (reinicia el onboarding)"
      data-testid="onboarding-reset"
    >
      <i className="fa-solid fa-rotate-left mr-1" aria-hidden="true"></i>
      Volver al inicio
    </button>
  );
}
```

**Integración Header.tsx:**
```tsx
function Header() {
  return (
    <header className="...">
      <Brand />
      <Tabs />
      <div className="flex items-center gap-3">
        <OnboardingResetButton />
        <ConnectionPill />
      </div>
    </header>
  );
}
```

**Methods nuevos en stores:**
```typescript
// projectStore.ts
resetProject: () => void; // Limpia brief, keyframes, transitions, clips, masterVideo

// uiStore.ts
resetAll: () => void; // Limpia tabs, modals, toasts
```

**Tests:**
```typescript
// src/__tests__/OnboardingResetButton.test.tsx
- Renderiza con aria-label y data-testid
- Click sin confirmar (window.confirm = false) → NO llama reset
- Click confirmado (window.confirm = true) → llama reset, resetAll, clear localStorage
- Muestra toast informativo
```

---

## 🔧 INTEGRACIÓN CON CÓDIGO EXISTENTE

| Archivo S1-S4 | Cambio Requerido |
|---|---|
| `src/App.tsx` | Render condicional LandingPage si !brief; SkipLink global |
| `src/components/common/Header.tsx` | Añadir OnboardingResetButton |
| `src/components/landing/LandingPage.tsx` (NUEVO) | Componente nuevo |
| `src/components/brief/BriefWizard.tsx` | Añadir `data-tour` attributes para tour anchors |
| `src/components/storyboard/KeyframeStoryboard.tsx` | Añadir `aria-label` por nodo + `role="button"` |
| `src/components/prompt/PromptApprovalGate.tsx` | `role="dialog"` + `aria-modal` + focus trap |
| `src/components/generation/SplitViewEditor.tsx` | `role="dialog"` + `aria-modal` + focus trap |
| `src/stores/uiStore.ts` | Nuevo: `hasSeenTour`, `showTourOnNextRender`, `resetAll()` |
| `src/stores/projectStore.ts` | Nuevo: `resetProject()` |
| `src/styles/globals.css` | Añadir `*:focus-visible` outline |
| `package.json` | Scripts: `test:a11y` |

---

## 🧪 PLAN DE TESTING INTEGRAL

### Unit Tests (Vitest, ≥80% coverage en nuevos archivos)

| Archivo | Tests Mínimos |
|---------|--------------|
| `GuidedTour.test.tsx` | 4 (no tour, start, onComplete, steps) |
| `LandingPage.test.tsx` | 3 (render, CTA, tour button hidden si visto) |
| `sectorTemplates.test.ts` | 3 (6 sectores, automotriz>=3 services, otro vacíos) |
| `SectorTemplateGrid.test.tsx` | 3 (render, click, aria-label) |
| `a11y-helpers.test.ts` | 3 (ariaLabelForService, etc.) |
| `useViewport.test.ts` | 3 (initial, resize, breakpoint thresholds) |
| `useFocusTrap.test.ts` | 4 (active, Tab cycling, Shift+Tab, cleanup) |
| `SkipLink.test.tsx` | 2 (render, focus visible) |
| `OnboardingResetButton.test.tsx` | 3 (render, confirm cancel, confirm OK) |

### E2E Tests (Playwright + axe-core)

| Test | Resultado Esperado |
|------|--------------------|
| `playwright/a11y-landing.spec.ts` | LandingPage → 0 violations axe-core |
| `playwright/a11y-brief-wizard.spec.ts` | BriefWizard con sector automotriz → 0 violations |
| `playwright/a11y-storyboard.spec.ts` | KeyframeStoryboard → 0 violations |
| `playwright/a11y-prompt-gate.spec.ts` | PromptApprovalGate focus trap + aria-modal correcto |
| `playwright/keyboard-navigation.spec.ts` | Tab navega todo, Esc cierra modal, Skip visible |

### Manual Acceptance Checklist (15 items)

Verificar tras implementación:

- [ ] **LandingPage** aparece cuando `!brief`
- [ ] Click "Crear mi primer spot" → abre BriefWizard
- [ ] Click "Iniciar tour guiado" → 3 tooltips consecutivos (Negocio → Servicios → Estilo)
- [ ] Botón "Iniciar tour" desaparece tras completarlo
- [ ] Selector de sectores muestra 6 opciones con emojis
- [ ] Click "Automotriz" → wizard pre-llenado con 3 servicios típicos
- [ ] Usuario edita solo campos deseados → wizard completo en <5 min
- [ ] **KeyframeStoryboard** cada nodo navegable con Tab + `aria-label` descriptivo
- [ ] **PromptApprovalGate** focus trap funciona (Tab cicla dentro)
- [ ] **Esc** cierra PromptApprovalGate
- [ ] **Skip Link** "Saltar al contenido principal" visible al primer Tab
- [ ] **Responsive iPad 1024px**: sidebar colapsable, sin overflow
- [ ] **Responsive iPhone 390px**: stack vertical, todo funcional
- [ ] **axe-core**: `pnpm test:a11y` → 0 violations
- [ ] **Botón "Volver al inicio"** en Header → confirm + reset total

---

## 🚀 HANDOFF A SOFIA (resumido)

**Orden de implementación recomendado:**

1. **Fase 0** (10min): `pnpm add driver.js @types/driver.js @axe-core/playwright`
2. **Fase 1** (1h): `data/sectorTemplates.ts` (6 sectores) + tests
3. **Fase 2** (1.5h): `LandingPage.tsx` + `GuidedTour.tsx` + `useGuidedTour` + integration App.tsx
4. **Fase 3** (1h): `useViewport.ts` + `responsive.css` + responsive component wrappers + tests
5. **Fase 4** (1h): `useFocusTrap.ts` + `SkipLink.tsx` + integration modales + tests
6. **Fase 5** (1h): Accessibility improvements (aria-label, role, focus-visible, semantic HTML) en componentes existentes
7. **Fase 6** (30min): `OnboardingResetButton.tsx` + stores reset methods + integration Header
8. **Fase 7** (30min): E2E Playwright tests con axe-core

**Validaciones finales:**
- `pnpm typecheck && pnpm test --run && pnpm lint && pnpm build` — todos verde
- 149 S1-S4 tests + ~23 S5 nuevos = **~172 tests** esperados
- Manual Acceptance 15 items

---

## 📌 NOTAS PARA SOFIA

1. **Driver.js v0.9+**: API moderna con `.drive()`, no la antigua `.start()`. Incluye types `@types/driver.js`.
2. **axe-core playwright**: import desde `@axe-core/playwright`. Constructor `new AxeBuilder({ page })`.
3. **Focus visible CSS**: Tailwind 3.4+ soporta `focus-visible:` variant. Usar `*:focus-visible` en globals.css.
4. **ARIA live regions**: Para cambios dinámicos (JobsPanel progreso, ETA), usar `<div aria-live="polite" aria-atomic="true">`. NO usar `assertive` (interrumpe screen readers).
5. **Skip links**: SIEMPRE el primero elemento tabbable de la página. `href="#main-content"` apunta al `<main id="main-content">`.
6. **NO romper S1-S4**: 149 tests anteriores deben seguir pasando. Confirmar antes/después.
7. **a11y en modales**: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (referencia al título).
8. **Responsive breakpoints**: mobile <640, tablet 640-1023, desktop ≥1024. Usar clases Tailwind `sm:` `md:` `lg:` consistentemente.
9. **E2E Playwright**: requiere `pnpm exec playwright install` para descargar browsers. Si falla, documentar.
10. **Onboarding Reset**: NO destructivo irreversible. Confirm siempre con `window.confirm`.

---

**Fin de SPEC-S5-WIZARD-A11Y.md**  
*Listo para delegación a SOFIA*