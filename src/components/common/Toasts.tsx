/**
 * Toast UI compartido.
 */

import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

const COLORS: Record<string, string> = {
  info: 'bg-sky-500/10 border-sky-500/40 text-sky-300',
  success: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
  warning: 'bg-amber-500/10 border-amber-500/40 text-amber-300',
  error: 'bg-rose-500/10 border-rose-500/40 text-rose-300',
};

const ICONS: Record<string, string> = {
  info: 'fa-circle-info',
  success: 'fa-circle-check',
  warning: 'fa-triangle-exclamation',
  error: 'fa-circle-xmark',
};

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-sm animate-fade-in',
            COLORS[t.kind],
          )}
        >
          <i className={`fa-solid ${ICONS[t.kind]} mt-0.5`} aria-hidden />
          <div className="flex-1 min-w-0">{t.message}</div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-current/70 hover:opacity-100 opacity-60 transition"
            aria-label="Cerrar notificación"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      ))}
    </div>
  );
}
