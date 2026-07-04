/**
 * VOTab — edición inline de voz en off + selector de voz + TTS por segmento.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.3.
 */

import { useState } from 'react';

export const VOICE_OPTIONS = ['Kore', 'Zephyr', 'Leda'] as const;
export type VoiceOption = (typeof VOICE_OPTIONS)[number];

export interface VOTabProps {
  initialText?: string;
  initialVoice?: VoiceOption;
  onRegenerateVO: (text: string, voice: VoiceOption) => Promise<void>;
}

export function VOTab({
  initialText = '',
  initialVoice = 'Kore',
  onRegenerateVO,
}: VOTabProps): JSX.Element {
  const [text, setText] = useState(initialText);
  const [voice, setVoice] = useState<VoiceOption>(initialVoice);
  const [busy, setBusy] = useState(false);

  const handleRegenerate = async (): Promise<void> => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onRegenerateVO(text, voice);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="panel-vo">
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        Texto voz en off
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="input text-xs resize-y"
        placeholder="Texto que se escuchará en este segmento…"
        data-testid="vo-text"
      />

      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        Voz (Gemini TTS)
      </label>
      <select
        value={voice}
        onChange={(e) => setVoice(e.target.value as VoiceOption)}
        className="input text-xs"
        data-testid="vo-voice"
      >
        {VOICE_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleRegenerate}
        disabled={busy || !text.trim()}
        data-testid="regenerate-vo"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs px-3 py-2 disabled:opacity-50"
      >
        {busy ? (
          <span className="loader-ring" style={{ width: 14, height: 14 }} />
        ) : (
          <i className="fa-solid fa-microphone" />
        )}
        Regenerar Audio (TTS)
      </button>

      {busy && (
        <p className="text-[10px] text-slate-500 italic">Sintetizando voz con Gemini TTS (~3-5s)…</p>
      )}
    </div>
  );
}