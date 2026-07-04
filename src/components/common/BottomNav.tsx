/**
 * BottomNav — barra de navegación inferior para mobile (<640px).
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.4.
 *
 * Solo se muestra cuando useViewport().isMobile === true.
 * Replica los 3 tabs principales (Brief / Storyboard / Export) en formato
 * horizontal bottom-sheet con safe-area inset.
 */

import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewport } from '@/hooks/useViewport';
import { cn } from '@/utils/cn';

type TabId = 'brief' | 'storyboard' | 'export';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'brief', label: 'Brief', icon: 'fa-clipboard-list' },
  { id: 'storyboard', label: 'Storyboard', icon: 'fa-film' },
  { id: 'export', label: 'Export', icon: 'fa-cloud-arrow-down' },
];

export function BottomNav(): JSX.Element | null {
  const { isMobile } = useViewport();
  const step = useUIStore((s) => s.currentStep);
  const setStep = useUIStore((s) => s.setStep);
  const briefReady = !!useProjectStore((s) => s.brief);

  if (!isMobile) return null;

  return (
    <nav
      role="navigation"
      aria-label="Navegación principal mobile"
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <ul className="flex items-stretch justify-around gap-1">
        {TABS.map((t) => {
          const active = step === t.id;
          const disabled = (t.id === 'storyboard' || t.id === 'export') && !briefReady;
          return (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => setStep(t.id)}
                disabled={disabled}
                aria-current={active ? 'page' : undefined}
                aria-label={t.label}
                className={cn(
                  'w-full py-2 px-2 rounded-lg flex flex-col items-center gap-0.5 transition-all',
                  'text-[10px] font-semibold',
                  active
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800',
                  disabled && 'opacity-40 cursor-not-allowed',
                )}
              >
                <i className={`fa-solid ${t.icon} text-base`} aria-hidden="true" />
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}