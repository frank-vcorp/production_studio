/**
 * PromptEditorV2 — editor con syntax highlight + token counter live.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.2.
 *
 * Implementación custom (sin CodeMirror) — overlay <pre> + textarea
 * transparente con caret blanco. Mantiene sincronización de scroll.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { countTokens, tokenStatus, TOKEN_LIMIT } from '@/utils/tokenCounter';
import { highlightPrompt } from '@/utils/syntaxHighlight';

export interface PromptEditorV2Props {
  initialPrompt: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
}

export function PromptEditorV2({
  initialPrompt,
  onChange,
  readOnly = false,
}: PromptEditorV2Props): JSX.Element {
  const [text, setText] = useState(initialPrompt);
  const overlayRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(initialPrompt);
  }, [initialPrompt]);

  const tokens = useMemo(() => countTokens(text), [text]);
  const status = useMemo(() => tokenStatus(tokens), [tokens]);
  const { segments } = useMemo(() => highlightPrompt(text), [text]);

  // Mantener sincronizado scroll del overlay con el textarea
  const handleScroll = (): void => {
    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const colorClass = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-rose-400',
  }[status.color];

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      {/* Header: token counter */}
      <div className="flex items-center justify-between bg-slate-900 px-3 py-2 border-b border-slate-800">
        <span className="text-[11px] text-slate-400">
          Tokens:{' '}
          <span className={`font-mono font-bold ${colorClass}`} data-testid="token-count">
            {tokens.toLocaleString()} / {TOKEN_LIMIT.toLocaleString()}
          </span>
        </span>
        <span className={`text-[11px] ${colorClass}`} data-testid="token-status">
          {status.message}
        </span>
      </div>

      {/* Editor: overlay + textarea */}
      <div className="relative flex-1 min-h-[200px]">
        <pre
          ref={overlayRef}
          aria-hidden="true"
          className="absolute inset-0 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words overflow-auto pointer-events-none"
          data-testid="syntax-overlay"
        >
          {segments.map((s, i) => (
            <span
              key={i}
              className={
                s.kind === 'cinema'
                  ? 'text-sky-400 font-semibold'
                  : s.kind === 'anchor'
                    ? 'text-emerald-400 font-bold'
                    : s.kind === 'movement'
                      ? 'text-amber-400 font-semibold'
                      : 'text-slate-200'
              }
            >
              {s.text}
            </span>
          ))}
        </pre>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value);
          }}
          onScroll={handleScroll}
          readOnly={readOnly}
          spellCheck={false}
          className="relative w-full h-full p-3 font-mono text-xs leading-relaxed text-transparent bg-transparent caret-white resize-none focus:outline-none"
          style={{ WebkitTextFillColor: 'transparent' }}
        />
      </div>
    </div>
  );
}