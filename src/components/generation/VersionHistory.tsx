/**
 * VersionHistory — UI compacta que lista las últimas versiones de prompt
 * por transición y permite restaurar en 1 click.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.4.
 */

import type { PromptVersion } from '@/types/transition';

export interface VersionHistoryProps {
  versions: PromptVersion[];
  currentVersionId?: number;
  onRestore: (version: PromptVersion) => void;
}

function timeAgo(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export function VersionHistory({
  versions,
  currentVersionId,
  onRestore,
}: VersionHistoryProps): JSX.Element {
  if (versions.length === 0) {
    return (
      <div
        className="bg-slate-950 border-t border-slate-800 p-3 text-[11px] text-slate-500"
        data-testid="version-history"
      >
        Sin versiones previas. Aprueba prompts para empezar el historial.
      </div>
    );
  }

  return (
    <div
      className="bg-slate-950 border-t border-slate-800 p-3 max-h-48 overflow-y-auto"
      data-testid="version-history"
    >
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        <i className="fa-solid fa-clock-rotate-left text-slate-500" />
        Historial (últimas {versions.length})
      </h4>
      <ul className="flex flex-col gap-1">
        {versions.map((v, idx) => {
          const isCurrent = v.version === currentVersionId;
          return (
            <li key={`v${v.version}`}>
              <button
                type="button"
                onClick={() => onRestore(v)}
                data-testid={`version-${idx}`}
                className={`w-full text-left px-2 py-1.5 rounded text-[11px] flex items-center gap-2 transition-colors ${
                  isCurrent
                    ? 'bg-sky-500/20 border border-sky-500/50 text-sky-200'
                    : 'hover:bg-slate-800 text-slate-200 border border-transparent'
                }`}
              >
                <span className="text-slate-500 font-mono font-bold">v{versions.length - idx}</span>
                <span className="truncate flex-1 font-mono">
                  {v.prompt.slice(0, 50).replace(/\n/g, ' ')}
                  {v.prompt.length > 50 ? '…' : ''}
                </span>
                <span className="text-slate-500 text-[10px] shrink-0">{timeAgo(v.approvedAt)}</span>
                {isCurrent && (
                  <span
                    data-testid={`version-current-badge-${idx}`}
                    className="text-[9px] font-bold uppercase bg-sky-500 text-slate-950 px-1.5 py-0.5 rounded"
                  >
                    actual
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}