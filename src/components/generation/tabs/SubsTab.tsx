/**
 * SubsTab — edición de subtítulo del segmento con preview safe-zone.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.3.
 */

import { useState } from 'react';

export interface SubsTabProps {
  initialText?: string;
  brandColor?: string;
  brandFont?: string;
  onUpdateSubtitles: (text: string) => Promise<void>;
}

export function SubsTab({
  initialText = '',
  brandColor = '#FFFFFF',
  brandFont = 'Inter',
  onUpdateSubtitles,
}: SubsTabProps): JSX.Element {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);

  const handleUpdate = async (): Promise<void> => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onUpdateSubtitles(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="panel-subs">
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        Texto subtítulo
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="input text-xs resize-y"
        placeholder="Subtítulo que se quemará sobre el clip…"
        data-testid="subs-text"
      />

      {/* Preview safe-zone */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold px-2 py-1 bg-slate-900">
          Preview safe zone (9:16, centro inferior)
        </div>
        <div className="relative h-24 bg-gradient-to-b from-slate-700 to-slate-900 flex items-end justify-center pb-3">
          <div
            className="px-3 py-1 text-sm font-semibold rounded text-center max-w-[80%]"
            style={{
              color: brandColor,
              fontFamily: brandFont,
              textShadow: '0 0 4px #000, 0 2px 2px #000',
            }}
          >
            {text || '(vacío)'}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleUpdate}
        disabled={busy || !text.trim()}
        data-testid="update-subs"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs px-3 py-2 disabled:opacity-50"
      >
        {busy ? (
          <span className="loader-ring" style={{ width: 14, height: 14 }} />
        ) : (
          <i className="fa-solid fa-closed-captioning" />
        )}
        Actualizar Subtítulos
      </button>
    </div>
  );
}