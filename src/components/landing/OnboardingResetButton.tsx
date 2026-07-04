/**
 * OnboardingResetButton — botón "Volver al inicio" con confirmación.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.6.
 *
 * - Click → window.confirm("¿Volver al inicio?")
 * - Si cancela: no hace nada
 * - Si confirma:
 *   - resetProject() del projectStore (limpia brief + keyframes + transitions + clips + masterVideo)
 *   - resetAll() del uiStore (limpia toasts, modals, tabs)
 *   - localStorage.removeItem('bridge_telemetry_optin') + 'bridge.brief.draft'
 *   - resetTour() para que vuelva a mostrarse el CTA del tour en LandingPage
 *   - toast info "Onboarding reiniciado."
 *
 * NO destructivo irreversible: el usuario debe confirmar siempre.
 */

import { useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

const TELEMETRY_KEY = 'bridge_telemetry_optin';
const BRIEF_DRAFT_KEY = 'bridge.brief.draft';

export interface OnboardingResetButtonProps {
  className?: string;
  label?: string;
}

export function OnboardingResetButton({
  className,
  label = 'Volver al inicio',
}: OnboardingResetButtonProps) {
  const resetProject = useProjectStore((s) => s.resetProject);
  const resetAll = useUIStore((s) => s.resetAll);
  const resetTour = useUIStore((s) => s.resetTour);
  const addToast = useUIStore((s) => s.addToast);

  const handleReset = useCallback(() => {
    const confirmed = window.confirm(
      '¿Volver al inicio? Esto borrará tu brief actual y todas las keyframes generadas. ¿Continuar?',
    );
    if (!confirmed) return;

    resetProject();
    resetAll();
    resetTour();
    try {
      localStorage.removeItem(TELEMETRY_KEY);
      localStorage.removeItem(BRIEF_DRAFT_KEY);
    } catch {
      // ignore quota / private mode
    }
    addToast({
      kind: 'info',
      message: 'Onboarding reiniciado. Bienvenido de nuevo.',
    });
  }, [resetProject, resetAll, resetTour, addToast]);

  return (
    <button
      type="button"
      onClick={handleReset}
      data-testid="onboarding-reset"
      aria-label="Volver al inicio (reinicia el onboarding)"
      className={cn(
        'text-xs text-slate-500 hover:text-amber-400 transition-colors inline-flex items-center gap-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-md px-1 py-0.5',
        className,
      )}
    >
      <i className="fa-solid fa-rotate-left" aria-hidden="true" />
      {label}
    </button>
  );
}