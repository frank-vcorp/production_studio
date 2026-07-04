/**
 * LandingPage — primera pantalla que ve un usuario nuevo.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.1.
 *
 * Renderiza:
 *  - Hero con título + subhero (privacidad)
 *  - 2 CTAs: "Crear mi primer spot" + "Iniciar tour guiado" (oculto si ya vio tour)
 *  - SectorTemplateGrid con 6 sectores para empezar con plantilla
 *
 * El botón "Iniciar tour" solo aparece si !hasSeenTour (single-use onboarding).
 */

import { Button } from '@/components/common/Button';
import { SectorTemplateGrid } from './SectorTemplateGrid';
import type { SectorId } from '@/types/sector';

export interface LandingPageProps {
  onCreateSpot: () => void;
  onStartTour: () => void;
  onSelectSector: (sector: SectorId) => void;
  hasSeenTour: boolean;
}

export function LandingPage({
  onCreateSpot,
  onStartTour,
  onSelectSector,
  hasSeenTour,
}: LandingPageProps) {
  return (
    <main
      id="main-content"
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 carbon-bg"
      data-testid="landing-page"
    >
      <header className="text-center max-w-3xl space-y-5">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/30">
            <i className="fa-solid fa-wand-magic-sparkles text-sky-400 text-xl" aria-hidden />
          </div>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
          Bridge Creative Engine
        </h1>
        <p className="text-lg md:text-xl text-slate-300 font-medium">
          Genera spots AIDA en minutos para Reels, TikTok y Shorts.
        </p>
        <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto">
          100% local. Tus datos nunca salen de tu navegador.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button
            variant="primary"
            size="lg"
            onClick={onCreateSpot}
            icon="fa-bolt"
            data-testid="landing-cta-create"
          >
            Crear mi primer spot
          </Button>
          {!hasSeenTour && (
            <Button
              variant="secondary"
              size="lg"
              onClick={onStartTour}
              icon="fa-route"
              data-testid="landing-cta-tour"
            >
              Iniciar tour guiado
            </Button>
          )}
        </div>
      </header>

      <section
        className="mt-12 max-w-5xl w-full"
        aria-labelledby="templates-heading"
      >
        <h2
          id="templates-heading"
          className="text-xl md:text-2xl font-bold text-white text-center mb-5"
        >
          O elige tu sector para empezar con plantillas
        </h2>
        <SectorTemplateGrid onSelect={onSelectSector} />
      </section>
    </main>
  );
}