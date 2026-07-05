/**
 * App.tsx — entry component S1 + S5 enhancements.
 *
 * S1: Tabs (Brief/Storyboard/Export) + Header + Wizard + Storyboard + Export.
 * S5: LandingPage condicional + Guided Tour + SkipLink + landmarks + BottomNav +
 *     OnboardingResetButton + integration con uiStore.hasSeenTour.
 *
 * Si !brief → muestra LandingPage (only para "nuevo" usuario).
 * Si brief → muestra MainApp con tabs + modales + toasts.
 *
 * ID: IMPL-20260704-05.
 */

import { useEffect, useState } from 'react';
import React from 'react';
import { BriefWizard } from '@/components/brief/BriefWizard';
import { KeyframeStoryboard } from '@/components/storyboard/KeyframeStoryboard';
import { PromptApprovalGate } from '@/components/prompt/PromptApprovalGate';
import { ExportCenter } from '@/components/generation/ExportCenter';
import { SplitViewHost } from '@/components/generation/SplitViewHost';
import { ToastContainer } from '@/components/common/Toasts';
import { Button } from '@/components/common/Button';
import { SkipLink } from '@/components/common/SkipLink';
import { BottomNav } from '@/components/common/BottomNav';
import { OnboardingResetButton } from '@/components/landing/OnboardingResetButton';
import { LandingPage } from '@/components/landing/LandingPage';
import { useGuidedTour } from '@/components/landing/GuidedTour';
import { WIZARD_TOUR_STEPS } from '@/components/landing/wizardTourSteps';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useApiKeysStore } from '@/stores/apiKeysStore';
import { applySectorTemplate } from '@/utils/sectorTemplate';
import { cn } from '@/utils/cn';
import type { SectorId } from '@/types/sector';

type TabId = 'brief' | 'storyboard' | 'export';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'brief',      label: 'Brief',      icon: 'fa-clipboard-list' },
  { id: 'storyboard', label: 'Storyboard', icon: 'fa-film' },
  { id: 'export',     label: 'Export',     icon: 'fa-cloud-arrow-down' },
];

export function App() {
  // Build marker v1.0.0-build-2026-07-04-18:11 — fuerza hash de Vite distinto para invalidar cache de Vercel CDN
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    // eslint-disable-next-line no-console
    console.info('[Bridge] v1.0.0-worker-ok');
  }

  const step = useUIStore((s) => s.currentStep);
  const setStep = useUIStore((s) => s.setStep);
  const brief = useProjectStore((s) => s.brief);
  const loadBrief = useProjectStore((s) => s.loadBrief);
  const resetProject = useProjectStore((s) => s.resetProject);
  const proxyConnected = useApiKeysStore((s) => s.proxyConnected);
  const checkProxy = useApiKeysStore((s) => s.checkProxy);
  const lastCheckedAt = useApiKeysStore((s) => s.lastCheckedAt);
  const hasSeenTour = useUIStore((s) => s.hasSeenTour);
  const showTourOnNextRender = useUIStore((s) => s.showTourOnNextRender);
  const markTourSeen = useUIStore((s) => s.markTourSeen);
  const setShowTourOnNextRender = useUIStore((s) => s.setShowTourOnNextRender);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  // S6: Hidratar el estado local de analytics al montar (si el usuario
  // ya optó-in en una sesión previa, respetamos su preferencia).
  useEffect(() => {
    let cancelled = false;
    import('@/services/analytics').then(({ analytics }) => {
      if (!cancelled) setAnalyticsEnabled(analytics.isEnabled());
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    checkProxy().catch(() => undefined);
  }, [checkProxy]);

  // S6 §6.6 — Analytics: registrar session_started una vez al montar.
  // session_ended se registra en beforeunload con duración calculada.
  const sessionStartRef = React.useRef<number>(Date.now());
  const sessionIdRef = React.useRef<string>('');
  useEffect(() => {
    if (!sessionIdRef.current) {
      // crypto.randomUUID puede no existir en navegadores antiguos — fallback.
      sessionIdRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      import('@/services/analytics').then(({ analytics }) => {
        analytics.record({
          type: 'session_started',
          sessionId: sessionIdRef.current,
          timestamp: sessionStartRef.current,
        });
      }).catch(() => undefined);

      const handleUnload = () => {
        const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);
        try {
          const events = JSON.parse(localStorage.getItem('bridge_analytics_events') ?? '[]');
          events.push({ type: 'session_ended', durationSec, timestamp: Date.now() });
          // Cap a 100 para mantener consistencia
          const capped = events.slice(-100);
          localStorage.setItem('bridge_analytics_events', JSON.stringify(capped));
        } catch {
          // ignore
        }
      };
      window.addEventListener('beforeunload', handleUnload);
      return () => window.removeEventListener('beforeunload', handleUnload);
    }
    return undefined;
  }, []);

  // S5: tour hook (se activa sólo cuando hay brief y el flag está activo)
  const tour = useGuidedTour(WIZARD_TOUR_STEPS, () => markTourSeen());

  // Si el usuario clickeó "Iniciar tour guiado" en LandingPage, lanzar al montar MainApp
  useEffect(() => {
    if (brief && showTourOnNextRender) {
      // Pequeño delay para que el DOM de los data-tour esté montado
      const id = setTimeout(() => {
        tour.start();
        setShowTourOnNextRender(false);
      }, 250);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [brief, showTourOnNextRender, tour, setShowTourOnNextRender]);

  // ── LandingPage si NO hay brief (nuevo usuario) ──
  if (!brief) {
    return (
      <>
        <SkipLink />
        <LandingPage
          hasSeenTour={hasSeenTour}
          onCreateSpot={() => {
            // Crea brief vacío para abrir el wizard
            const empty = applySectorTemplate('otro');
            loadBrief(empty);
            markTourSeen();
          }}
          onStartTour={() => {
            // Carga brief vacío y marca flag para lanzar tour tras montar wizard
            const empty = applySectorTemplate('otro');
            loadBrief(empty);
            markTourSeen();
            setShowTourOnNextRender(true);
          }}
          onSelectSector={(sector: SectorId) => {
            const seeded = applySectorTemplate(sector);
            loadBrief(seeded);
            markTourSeen();
          }}
        />
        <ToastContainer />
      </>
    );
  }

  // ── MainApp: usuario con brief cargado ──
  return (
    <div className="min-h-screen flex flex-col carbon-bg">
      <SkipLink />

      {/* HEADER */}
      <header role="banner" className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/30">
              <i className="fa-solid fa-wand-magic-sparkles text-sky-400 text-lg" aria-hidden />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
                Bridge Creative Engine
              </div>
              <h1 className="text-lg md:text-xl font-extrabold text-white flex items-center gap-2">
                {brief?.business.name ?? 'Nuevo Estudio'}
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                  S5
                </span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border flex items-center gap-2',
                proxyConnected
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400',
              )}
              title={lastCheckedAt ? `Última verificación: ${new Date(lastCheckedAt).toLocaleTimeString()}` : 'Sin verificar'}
            >
              <span className={cn('h-2 w-2 rounded-full', proxyConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
              {proxyConnected ? 'Conectado via Proxy' : 'Sin conexión al proxy'}
            </div>
            {/* Botón "Nuevo Proyecto" — siempre visible para empezar de nuevo */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('¿Empezar un nuevo proyecto?\n\nSe borrará:\n• El brief actual\n• Las keyframes subidas\n• Los clips generados\n• El master video\n\nEsta acción no se puede deshacer.')) {
                  resetProject();
                  window.location.reload();
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50 transition-colors text-sm font-semibold"
              aria-label="Empezar un nuevo proyecto desde cero"
              data-testid="new-project-button"
            >
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
              <span className="hidden sm:inline">Nuevo proyecto</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
              aria-label="Settings"
              aria-expanded={settingsOpen}
            >
              <i className="fa-solid fa-gear text-lg" />
            </button>
          </div>
        </div>

        {settingsOpen && (
          <div className="max-w-7xl mx-auto mt-3 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-slate-300">
              <span className="text-sky-400 font-mono">/api/gemini</span> (relativo, sin keys)
              <br />
              Worker: <span className="text-sky-300 font-mono">wrangler dev --port 8787</span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Button variant="secondary" size="sm" onClick={() => checkProxy()} icon="fa-rotate">
                Re-verificar proxy
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="fa-trash"
                onClick={() => {
                  if (confirm('¿Resetear proyecto y limpiar IndexedDB?')) {
                    resetProject();
                  }
                }}
              >
                Reset proyecto
              </Button>
              <OnboardingResetButton />
            </div>
            {/* S6 §6.6 — Privacy tab: analytics opt-in GDPR-safe */}
            <div
              className="w-full mt-3 pt-3 border-t border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              data-testid="privacy-section"
              role="region"
              aria-label="Privacidad y analytics"
            >
              <div className="text-slate-300">
                <span className="text-sky-400 font-bold">
                  <i className="fa-solid fa-shield-halved mr-1" aria-hidden /> Privacidad
                </span>
                <span className="text-slate-400 ml-2">
                  Compartir eventos anónimos nos ayuda a mejorar. Sin PII — solo contadores y sector.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-sky-500 h-4 w-4"
                  data-testid="analytics-optin-toggle"
                  aria-label="Activar analytics anónimo"
                  checked={analyticsEnabled}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setAnalyticsEnabled(v);
                    import('@/services/analytics').then(({ analytics }) => {
                      analytics.setOptIn(v);
                    }).catch(() => undefined);
                  }}
                />
                <span className="text-slate-200 font-semibold">
                  {analyticsEnabled ? 'Activado' : 'Desactivado'}
                </span>
              </label>
            </div>
          </div>
        )}
      </header>

      {/* TABS */}
      <nav role="navigation" aria-label="Tabs principales" className="max-w-7xl w-full mx-auto px-4 md:px-6 pt-6">
        <div role="tablist" aria-label="Secciones de la app" className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setStep(t.id)}
              role="tab"
              aria-selected={step === t.id}
              className={cn(
                'flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-semibold text-xs transition-all duration-300 flex items-center justify-center gap-2',
                step === t.id
                  ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/10'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800',
              )}
            >
              <i className={`fa-solid ${t.icon}`} aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* MAIN */}
      <main id="main-content" role="main" className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 gap-6 pb-20 md:pb-6">
        {step === 'brief' && <BriefWizard />}
        {step === 'storyboard' && <KeyframeStoryboard briefReady={!!brief} />}
        {step === 'export' && <ExportCenter />}
      </main>

      <PromptApprovalGate />
      <SplitViewHost />
      <ToastContainer />
      <BottomNav />

      <footer role="contentinfo" className="border-t border-slate-800 px-4 md:px-6 py-4 text-center text-[11px] text-slate-500">
        <span>Bridge Creative Engine · S5 Wizard + Accesibilidad · Standalone · Gemini-only · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}