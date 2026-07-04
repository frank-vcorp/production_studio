/**
 * SplitViewEditor — editor granular inline con split resizable + keyboard shortcuts.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.1 + §4.7.
 *
 * Layout fullscreen modal:
 *   - Header: nodo + botón cerrar
 *   - Split 50/50 (left: InlineNodeEditor/PromptEditorV2, right: Preview + VersionHistory)
 *   - Drag divider (cursor col-resize, persiste % en localStorage por transitionId)
 *   - Footer: ETA smart concat + acciones (Aprobar / Cancelar)
 *
 * Integra useKeyboardShortcuts (Cmd+Enter aprobar, Esc cerrar, Tab ciclar tabs).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyframeTransition, PromptVersion, AidaNodeKey } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';
import { InlineNodeEditor } from '@/components/generation/InlineNodeEditor';
import { cycleNodeEditTab, type NodeEditTab } from '@/components/generation/nodeEditTab';
import { VersionHistory } from '@/components/generation/VersionHistory';
import { PromptEditorV2 } from '@/components/prompt/PromptEditorV2';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';

const NODE_LABEL: Record<AidaNodeKey, string> = {
  bumper: 'Cortinilla',
  atencion: 'Atención',
  interes: 'Interés',
  deseo: 'Deseo',
  accion: 'Acción',
  cta: 'CTA Final',
};

const SPLIT_MIN = 20;
const SPLIT_MAX = 80;
const SPLIT_DEFAULT = 50;

function clampSplit(p: number): number {
  return Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, p));
}

function readSplit(transitionId: string): number {
  try {
    const v = localStorage.getItem(`split_${transitionId}`);
    if (v == null) return SPLIT_DEFAULT;
    const n = Number(v);
    if (Number.isFinite(n)) return clampSplit(n);
    return SPLIT_DEFAULT;
  } catch {
    return SPLIT_DEFAULT;
  }
}

function writeSplit(transitionId: string, percent: number): void {
  try {
    localStorage.setItem(`split_${transitionId}`, String(percent));
  } catch {
    // localStorage puede estar deshabilitado (modo privado) — ignorar
  }
}

export interface SplitViewEditorProps {
  transitionId: string;
  transition: KeyframeTransition;
  keyframeFrom: Keyframe;
  keyframeTo: Keyframe;
  promptVersion: PromptVersion;
  versions: PromptVersion[];
  onApprove: (finalPrompt: string) => Promise<void>;
  onRegenerateVisual: (intent: string) => Promise<void>;
  onRegenerateVO: (text: string, voice: string) => Promise<void>;
  onUpdateSubtitles: (text: string) => Promise<void>;
  onUpdateCameraSpec: (spec: KeyframeTransition['cameraSpec']) => Promise<void>;
  onRestoreVersion: (version: PromptVersion) => void;
  onClose: () => void;
}

export function SplitViewEditor({
  transitionId,
  transition,
  keyframeFrom,
  keyframeTo,
  promptVersion,
  versions,
  onApprove,
  onRegenerateVisual,
  onRegenerateVO,
  onUpdateSubtitles,
  onUpdateCameraSpec,
  onRestoreVersion,
  onClose,
}: SplitViewEditorProps): JSX.Element {
  const [splitPercent, setSplitPercent] = useState<number>(() => readSplit(transitionId));
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<NodeEditTab>('visual');
  const [draftPrompt, setDraftPrompt] = useState(promptVersion.prompt);
  const [busyApprove, setBusyApprove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist split cuando no se está arrastrando
  useEffect(() => {
    if (!isDragging) writeSplit(transitionId, splitPercent);
  }, [splitPercent, transitionId, isDragging]);

  // Handlers de drag
  const handleMouseMove = useCallback(
    (e: MouseEvent): void => {
      if (!isDragging) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const newPct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(clampSplit(newPct));
    },
    [isDragging],
  );

  const handleMouseUp = useCallback((): void => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleApprove = useCallback(async (): Promise<void> => {
    if (!draftPrompt.trim()) return;
    setBusyApprove(true);
    try {
      await onApprove(draftPrompt.trim());
    } finally {
      setBusyApprove(false);
    }
  }, [draftPrompt, onApprove]);

  // Keyboard shortcuts — se desactivan al desmontar
  const shortcuts = useMemo(
    () => ({
      onApprove: () => void handleApprove(),
      onClose,
      onCycleTab: (dir: 1 | -1) => setActiveTab((t) => cycleNodeEditTab(t, dir)),
    }),
    [handleApprove, onClose],
  );
  useKeyboardShortcuts(shortcuts, true);

  const previewUrl = transition.videoUrl ?? '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-2"
      role="dialog"
      aria-modal="true"
      aria-label="Editor granular de nodo"
      data-testid="split-view-editor"
    >
      <div className="w-full h-full max-w-[1400px] max-h-[94vh] bg-slate-900 border border-sky-500/30 rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 p-3 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <i className="fa-solid fa-sliders text-sky-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                Editor Granular — {NODE_LABEL[transition.nodeKey]}
              </h2>
              <p className="text-[10px] text-slate-400 truncate">
                {transition.duration}s · v{promptVersion.version}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="split-close"
            aria-label="Cerrar editor granular"
            className="text-slate-400 hover:text-white p-1.5"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </header>

        {/* Split container */}
        <div
          ref={containerRef}
          id={`split-container-${transitionId}`}
          className="flex-1 flex overflow-hidden"
        >
          {/* LEFT: Inline editor */}
          <div
            data-testid="split-left"
            style={{ width: `${splitPercent}%` }}
            className="flex flex-col border-r border-slate-800 min-w-0"
          >
            <PromptEditorV2
              initialPrompt={draftPrompt}
              onChange={setDraftPrompt}
            />
            <div className="flex-1 min-h-0">
              <InlineNodeEditor
                transition={transition}
                keyframeFrom={keyframeFrom}
                keyframeTo={keyframeTo}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onRegenerateVisual={onRegenerateVisual}
                onRegenerateVO={onRegenerateVO}
                onUpdateSubtitles={onUpdateSubtitles}
                onUpdateCameraSpec={onUpdateCameraSpec}
              />
            </div>
          </div>

          {/* DIVIDER */}
          <div
            data-testid="split-divider"
            role="separator"
            aria-orientation="vertical"
            onMouseDown={() => setIsDragging(true)}
            className={cn(
              'w-1.5 cursor-col-resize transition-colors shrink-0',
              isDragging
                ? 'bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                : 'bg-slate-800 hover:bg-sky-500',
            )}
          />

          {/* RIGHT: preview + history */}
          <div
            data-testid="split-right"
            style={{ width: `${100 - splitPercent}%` }}
            className="flex flex-col min-w-0"
          >
            <div className="flex-1 bg-black flex items-center justify-center min-h-0">
              {previewUrl ? (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-full max-w-full"
                  data-testid="clip-preview"
                />
              ) : (
                <div className="text-slate-500 text-xs italic">Sin preview todavía</div>
              )}
            </div>
            <VersionHistory
              versions={versions}
              currentVersionId={promptVersion.version}
              onRestore={(v) => {
                setDraftPrompt(v.prompt);
                onRestoreVersion(v);
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 p-3 border-t border-slate-800">
          <span className="text-[10px] text-slate-400 flex items-center gap-2">
            <i className="fa-solid fa-bolt text-amber-400" />
            ETA Smart Concat: ~{Math.max(8, Math.min(15, Math.round(splitPercent / 8)))}s
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busyApprove}>
              Cancelar
            </Button>
            <Button
              variant="success"
              size="sm"
              icon="fa-bolt"
              onClick={handleApprove}
              disabled={!draftPrompt.trim()}
              loading={busyApprove}
              data-testid="approve-btn"
            >
              Aprobar (⌘↵)
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}