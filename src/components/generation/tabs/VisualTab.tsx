/**
 * VisualTab — regeneración de visual (Imagen 3 KF_OUT + Veo transición).
 * Spec: SPEC-S4-GRANULAR-EDIT §4.3.
 *
 * Layout: mini-preview KF_IN/KF_OUT + textarea intención + botón Regenerar.
 */

import { useState } from 'react';
import type { Keyframe } from '@/types/keyframe';

export interface VisualTabProps {
  keyframeFrom?: Keyframe;
  keyframeTo?: Keyframe;
  initialIntent?: string;
  onRegenerateVisual: (intent: string) => Promise<void>;
}

export function VisualTab({
  keyframeFrom,
  keyframeTo,
  initialIntent = '',
  onRegenerateVisual,
}: VisualTabProps): JSX.Element {
  const [intent, setIntent] = useState(initialIntent);
  const [busy, setBusy] = useState(false);

  const handleRegenerate = async (): Promise<void> => {
    setBusy(true);
    try {
      await onRegenerateVisual(intent);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="panel-visual">
      {/* Mini-preview FROM / TO */}
      <div className="grid grid-cols-2 gap-2">
        <ThumbFrame label="FROM (IN)" keyframe={keyframeFrom} />
        <ThumbFrame label="TO (OUT)" keyframe={keyframeTo} />
      </div>

      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        Intención humana (qué quieres ver al final)
      </label>
      <textarea
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        rows={3}
        className="input text-xs resize-y"
        placeholder="Ej: abrir a motor sucio desenfocado"
        data-testid="visual-intent"
      />

      <button
        type="button"
        onClick={handleRegenerate}
        disabled={busy}
        data-testid="regenerate-visual"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 font-semibold text-xs px-3 py-2 disabled:opacity-50"
      >
        {busy ? (
          <span className="loader-ring" style={{ width: 14, height: 14 }} />
        ) : (
          <i className="fa-solid fa-wand-magic-sparkles" />
        )}
        Regenerar Visual (Imagen 3 + Veo)
      </button>

      {busy && (
        <p className="text-[10px] text-slate-500 italic">
          Generando Imagen 3 (~10s) + Veo 3.1 (~2 min)…
        </p>
      )}
    </div>
  );
}

function ThumbFrame({ label, keyframe }: { label: string; keyframe?: Keyframe }): JSX.Element {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold px-2 py-1 bg-slate-900">
        {label}
      </div>
      <div className="h-20 flex items-center justify-center bg-slate-950">
        {keyframe?.blob ? (
          <img
            src={
              keyframe.base64
                ? `data:${keyframe.mimeType ?? 'image/png'};base64,${keyframe.base64}`
                : URL.createObjectURL(keyframe.blob)
            }
            alt={keyframe.label}
            className="object-cover w-full h-full"
          />
        ) : (
          <i className="fa-solid fa-image text-slate-700 text-lg" />
        )}
      </div>
    </div>
  );
}