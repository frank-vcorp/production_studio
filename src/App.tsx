import { useEffect, useState } from 'react';
import { BriefWizard } from '@/components/brief/BriefWizard';
import { KeyframeStoryboard } from '@/components/storyboard/KeyframeStoryboard';
import { PromptApprovalGate } from '@/components/prompt/PromptApprovalGate';
import { ExportCenter } from '@/components/generation/ExportCenter';
import { ToastContainer } from '@/components/common/Toasts';
import { Button } from '@/components/common/Button';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useApiKeysStore } from '@/stores/apiKeysStore';
import { cn } from '@/utils/cn';

type TabId = 'brief' | 'storyboard' | 'export';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'brief',      label: 'Brief',      icon: 'fa-clipboard-list' },
  { id: 'storyboard', label: 'Storyboard', icon: 'fa-film' },
  { id: 'export',     label: 'Export',     icon: 'fa-cloud-arrow-down' },
];

export function App() {
  const step = useUIStore((s) => s.currentStep);
  const setStep = useUIStore((s) => s.setStep);
  const brief = useProjectStore((s) => s.brief);
  const resetProject = useProjectStore((s) => s.resetProject);
  const proxyConnected = useApiKeysStore((s) => s.proxyConnected);
  const checkProxy = useApiKeysStore((s) => s.checkProxy);
  const lastCheckedAt = useApiKeysStore((s) => s.lastCheckedAt);

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    checkProxy().catch(() => undefined);
  }, [checkProxy]);

  return (
    <div className="min-h-screen flex flex-col carbon-bg">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 py-4">
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
                  S1
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
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="text-slate-400 hover:text-white"
              aria-label="Settings"
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
            <div className="flex gap-2">
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
            </div>
          </div>
        )}
      </header>

      {/* TABS */}
      <div className="max-w-7xl w-full mx-auto px-4 md:px-6 pt-6">
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setStep(t.id)}
              className={cn(
                'flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-semibold text-xs transition-all duration-300 flex items-center justify-center gap-2',
                step === t.id
                  ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800',
              )}
            >
              <i className={`fa-solid ${t.icon}`} aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 gap-6">
        {step === 'brief' && <BriefWizard />}
        {step === 'storyboard' && <KeyframeStoryboard briefReady={!!brief} />}
        {step === 'export' && <ExportCenter />}
      </main>

      <PromptApprovalGate />
      <ToastContainer />

      <footer className="border-t border-slate-800 px-4 md:px-6 py-4 text-center text-[11px] text-slate-500">
        <span>Bridge Creative Engine · S1 Foundation · Standalone · Gemini-only · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
