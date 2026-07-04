/**
 * CameraTab — edición del CameraSpec de la transición.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.3.
 *
 * Mantiene shape CameraSpec del modelo (movement/framing/angle/speed).
 */

import { useState } from 'react';
import type { CameraSpec } from '@/types/keyframe';

export interface CameraTabProps {
  initialSpec: CameraSpec;
  onUpdateCameraSpec: (spec: CameraSpec) => Promise<void>;
}

const PRESETS: { label: string; spec: CameraSpec }[] = [
  {
    label: 'Macro probe',
    spec: { movement: 'push-in', framing: 'macro', angle: 'eye level', speed: 'slow' },
  },
  {
    label: 'Steadicam dolly',
    spec: { movement: 'dolly out', framing: 'medium', angle: 'eye level', speed: 'medium' },
  },
  {
    label: 'Handheld',
    spec: { movement: 'handheld', framing: 'medium close-up', angle: 'eye level', speed: 'fast' },
  },
  {
    label: 'Crane up',
    spec: { movement: 'crane', framing: 'wide', angle: 'low angle', speed: 'slow' },
  },
];

export function CameraTab({ initialSpec, onUpdateCameraSpec }: CameraTabProps): JSX.Element {
  const [spec, setSpec] = useState<CameraSpec>(initialSpec);
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof CameraSpec>(k: K, v: CameraSpec[K]): void => {
    setSpec((s) => ({ ...s, [k]: v }));
  };

  const handleSave = async (): Promise<void> => {
    setBusy(true);
    try {
      await onUpdateCameraSpec(spec);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="panel-camera">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setSpec(p.spec)}
            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded border border-slate-700"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Movimiento">
          <input
            type="text"
            value={spec.movement}
            onChange={(e) => update('movement', e.target.value)}
            className="input text-xs"
            data-testid="camera-movement"
          />
        </Field>
        <Field label="Encuadre">
          <input
            type="text"
            value={spec.framing}
            onChange={(e) => update('framing', e.target.value)}
            className="input text-xs"
          />
        </Field>
        <Field label="Ángulo">
          <input
            type="text"
            value={spec.angle}
            onChange={(e) => update('angle', e.target.value)}
            className="input text-xs"
          />
        </Field>
        <Field label="Velocidad">
          <select
            value={spec.speed}
            onChange={(e) => update('speed', e.target.value as CameraSpec['speed'])}
            className="input text-xs"
          >
            <option value="slow">slow</option>
            <option value="medium">medium</option>
            <option value="fast">fast</option>
          </select>
        </Field>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        data-testid="save-camera"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-semibold text-xs px-3 py-2 disabled:opacity-50"
      >
        {busy ? (
          <span className="loader-ring" style={{ width: 14, height: 14 }} />
        ) : (
          <i className="fa-solid fa-camera" />
        )}
        Guardar CameraSpec
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</span>
      {children}
    </label>
  );
}