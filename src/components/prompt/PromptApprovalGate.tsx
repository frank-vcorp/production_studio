import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/common/Button';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import {
  buildKeyframeTransitionPrompt,
} from '@/services/promptBuilder';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';

export function PromptApprovalGate() {
  const open = useProjectStore((s) => s.promptGateOpen);
  const activeId = useProjectStore((s) => s.activeTransitionId);
  const closePromptGate = useProjectStore((s) => s.closePromptGate);
  const approveTransitionPrompt = useProjectStore((s) => s.approveTransitionPrompt);
  const generateTransition = useProjectStore((s) => s.generateTransition);
  const transitions = useProjectStore((s) => s.transitions);
  const keyframes = useProjectStore((s) => s.keyframes);
  const brief = useProjectStore((s) => s.brief);
  const brandKit = useProjectStore((s) => s.brandKit);
  const addToast = useUIStore((s) => s.addToast);

  const transition = activeId ? transitions.get(activeId) : undefined;
  const fromKf = transition ? keyframes.get(transition.fromKeyframe) : undefined;
  const toKf = transition ? keyframes.get(transition.toKeyframe) : undefined;

  const initialPrompt = useMemo(() => {
    if (!transition || !fromKf || !toKf) return '';
    if (transition.prompt) return transition.prompt;
    return buildKeyframeTransitionPrompt({
      fromKf,
      toKf,
      nodeKey: transition.nodeKey,
      cameraSpec: transition.cameraSpec,
      humanIntent: fromKf.humanIntent,
      brief,
      brandKit,
      serviceNodeText: brief?.services[0]?.stages[stageForNode(transition.nodeKey)],
    });
  }, [transition, fromKf, toKf, brief, brandKit]);

  const [draft, setDraft] = useState(initialPrompt);
  const [showDiff, setShowDiff] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setDraft(initialPrompt);
  }, [initialPrompt, open]);

  if (!open || !transition || !fromKf || !toKf) return null;

  const handleApprove = async () => {
    if (!draft.trim()) {
      addToast({ kind: 'warning', message: 'El prompt no puede estar vacío.' });
      return;
    }
    approveTransitionPrompt(transition.id, draft.trim());
    addToast({ kind: 'success', message: 'Prompt aprobado. Lanzando Veo...' });
    closePromptGate();
    try {
      setGenerating(true);
      await generateTransition(transition.id);
      // Tras aprobar, simulamos la generación: en S1 el cliente llama Veo vía service.
      // Para evitar bloquear el flujo cuando no hay API key, dejamos el estado en 'generating'
      // y el caller integrará el resultado cuando vuelva.
    } catch (e) {
      addToast({ kind: 'error', message: (e as Error).message ?? 'Error al lanzar Veo' });
    } finally {
      setGenerating(false);
    }
  };

  const tokenEstimate = Math.ceil(draft.length / 4);
  const originalPrompt = transition.prompt || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-sky-500/30 rounded-2xl neon-border flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <i className="fa-solid fa-shield-halved text-sky-400" /> Prompt Approval Gate
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Nodo <span className="text-sky-300 font-bold uppercase">{transition.nodeKey}</span> ·{' '}
              {transition.duration}s · modelo <span className="text-fuchsia-300">veo-3.1</span>
            </p>
          </div>
          <button
            onClick={closePromptGate}
            className="text-slate-500 hover:text-white"
            aria-label="Cerrar"
          >
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-4 border-b border-slate-800">
          <AnchorCard label="INICIAL (FROM)" keyframe={fromKf} />
          <AnchorCard label="FINAL (TO)" keyframe={toKf} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-pen text-sky-400" />
              Prompt editable (monospace)
            </div>
            <div className="flex items-center gap-3">
              <span>
                {draft.length} chars · ~{tokenEstimate} tokens · {draft.split('\n').length} líneas
              </span>
              {originalPrompt && (
                <button
                  onClick={() => setShowDiff((v) => !v)}
                  className="text-sky-400 hover:underline"
                >
                  {showDiff ? 'Ocultar diff' : 'Mostrar diff'}
                </button>
              )}
              {originalPrompt && (
                <button
                  onClick={() => setDraft(originalPrompt)}
                  className="text-amber-400 hover:underline"
                >
                  Restaurar original
                </button>
              )}
            </div>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
            style={{ minHeight: 360 }}
            disabled={generating}
          />
          {showDiff && originalPrompt && (
            <DiffView original={originalPrompt} modified={draft} />
          )}
          <p className="text-[11px] text-slate-500 italic">
            Cada prompt incluye anclas visuales, intención humana, cámara y la regla "NO INVENTES".
          </p>
        </div>

        <footer className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-800">
          <div className="text-xs text-slate-500">
            <i className="fa-solid fa-lock mr-1" />
            Nada se genera hasta que apruebes.
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={closePromptGate} disabled={generating}>
              Cancelar
            </Button>
            <Button
              variant="success"
              icon="fa-bolt"
              onClick={handleApprove}
              disabled={!draft.trim() || generating}
              loading={generating}
            >
              Aprobar y generar
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function AnchorCard({ label, keyframe }: { label: string; keyframe: Keyframe | undefined }) {
  if (!keyframe) {
    return (
      <div className="bg-slate-950 border border-dashed border-slate-700 rounded-xl p-4 text-xs text-slate-500">
        {label}: sin keyframe
      </div>
    );
  }
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
      <div className="w-20 h-28 rounded-md overflow-hidden bg-slate-900 flex items-center justify-center shrink-0">
        {keyframe.blob ? (
          <img
            src={URL.createObjectURL(keyframe.blob)}
            alt={keyframe.label}
            className="object-cover w-full h-full"
          />
        ) : (
          <i className="fa-solid fa-image text-slate-600 text-xl" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-sky-400 font-bold">{label}</div>
        <div className="text-sm text-white font-semibold truncate">{keyframe.label}</div>
        {keyframe.visualAnalysis && (
          <>
            <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">{keyframe.visualAnalysis.subject}</p>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{keyframe.visualAnalysis.environment}</p>
          </>
        )}
        {!keyframe.visualAnalysis && (
          <p className="text-[10px] text-slate-500 mt-1 italic">Sin análisis todavía</p>
        )}
      </div>
    </div>
  );
}

function DiffView({ original, modified }: { original: string; modified: string }) {
  const { added, removed } = diffLines(original, modified);
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-48 overflow-auto text-[11px] font-mono">
      {removed.map((line, i) => (
        <div key={`r${i}`} className="text-rose-300">
          - {line}
        </div>
      ))}
      {added.map((line, i) => (
        <div key={`a${i}`} className="text-emerald-300">
          + {line}
        </div>
      ))}
    </div>
  );
}

function diffLines(a: string, b: string): { added: string[]; removed: string[] } {
  const A = new Set(a.split('\n'));
  const B = new Set(b.split('\n'));
  const removed: string[] = [];
  const added: string[] = [];
  a.split('\n').forEach((l) => { if (!B.has(l)) removed.push(l); });
  b.split('\n').forEach((l) => { if (!A.has(l)) added.push(l); });
  return { added, removed };
}

function stageForNode(nodeKey: KeyframeTransition['nodeKey']): 'attention' | 'interest' | 'desire' | 'action' {
  switch (nodeKey) {
    case 'bumper': return 'attention';
    case 'atencion': return 'attention';
    case 'interes': return 'interest';
    case 'deseo': return 'desire';
    case 'accion': return 'action';
    case 'cta': return 'action';
  }
}
