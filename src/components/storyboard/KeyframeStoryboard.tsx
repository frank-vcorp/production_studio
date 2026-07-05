import { memo, useCallback, useState } from 'react';
import { cn } from '@/utils/cn';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/common/Button';
import { analyzeImageForVeo } from '@/services/gemini/imageAnalysis';
import { ariaLabelForKeyframe } from '@/utils/a11y';
import { IntentTextarea } from './IntentTextarea';
import type { Keyframe, KeyframeRole, KeyframeStatus } from '@/types/keyframe';
import { STORYBOARD_SLOTS, STORYBOARD_STRUCTURE } from '@/types/keyframe';

const STATUS_LABEL: Record<KeyframeStatus, string> = {
  empty: 'Vacío',
  uploaded: 'Subida',
  analyzed: 'Analizada',
  generating: 'Generando',
  generated: 'Generada',
  approved: 'Aprobada',
  failed: 'Falló',
};

const STATUS_COLOR: Record<KeyframeStatus, string> = {
  empty: 'bg-slate-700 text-slate-300',
  uploaded: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  analyzed: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  generating: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  generated: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  failed: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

interface SlotProps {
  role: KeyframeRole;
  label: string;
  description: string;
  kf: Keyframe | undefined;
  onUpload: () => void;
}

export const KeyframeSlotView = memo(function KeyframeSlotView({ role, label, description, kf, onUpload }: SlotProps) {
  const [expanded, setExpanded] = useState(false);
  const openPromptGate = useProjectStore((s) => s.openPromptGate);
  const analyzeKeyframe = useProjectStore((s) => s.analyzeKeyframe);
  const approveKeyframe = useProjectStore((s) => s.approveKeyframe);
  const transitions = useProjectStore((s) => s.transitions);
  const openSplitView = useUIStore((s) => s.openSplitView);
  const addToast = useUIStore((s) => s.addToast);

  const status: KeyframeStatus = kf?.status ?? 'empty';
  const isOut = role.endsWith('_out');
  const needsAnalysis = status === 'uploaded';
  const showApproveBtn = (status === 'generated' || status === 'analyzed') && !isOut;
  const showIntent = !isOut && (status === 'analyzed' || status === 'generated' || status === 'approved');

  const handleAnalyze = useCallback(async () => {
    if (!kf || !kf.blob) {
      addToast({ kind: 'warning', message: 'Sube una imagen primero.' });
      return;
    }
    try {
      addToast({ kind: 'info', message: `Analizando ${label} con Gemini Vision...` });
      await analyzeKeyframe(kf.id);
      const va = await analyzeImageForVeo(kf.blob);
      useProjectStore.setState((s) => {
        const cur = s.keyframes.get(kf.id);
        if (cur) {
          const next = new Map(s.keyframes);
          next.set(kf.id, { ...cur, visualAnalysis: va, status: 'analyzed' });
          return { keyframes: next };
        }
        return s;
      });
      addToast({ kind: 'success', message: `${label} analizada.` });
    } catch (e) {
      const msg = (e as Error).message ?? 'Error';
      addToast({ kind: 'error', message: `Error al analizar: ${msg}` });
    }
  }, [analyzeKeyframe, kf, addToast, label]);

  const handleApprove = useCallback(() => {
    if (kf) approveKeyframe(kf.id);
    addToast({ kind: 'success', message: `${label} aprobada.` });
  }, [approveKeyframe, kf, addToast, label]);

  // Encontrar transición saliente
  const outgoing = Array.from(transitions.values()).find((t) => t.fromKeyframe === kf?.id);
  const canGenerateClip = outgoing && outgoing.status === 'pending';
  const canEditGranular = outgoing && (outgoing.status === 'done' || outgoing.status === 'approved' || outgoing.status === 'failed');

  const handleGenerateClip = useCallback(() => {
    if (!outgoing) {
      addToast({ kind: 'warning', message: 'No hay transición saliente todavía.' });
      return;
    }
    openPromptGate(outgoing.id);
  }, [outgoing, openPromptGate, addToast]);

  const handleEditGranular = useCallback(() => {
    if (!outgoing) {
      addToast({ kind: 'warning', message: 'No hay transición saliente todavía.' });
      return;
    }
    openSplitView(outgoing.id);
  }, [outgoing, openSplitView, addToast]);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={ariaLabelForKeyframe(kf, role)}
      data-testid={`keyframe-slot-${role}`}
      onKeyDown={(e) => {
        // Permite Enter/Space para abrir el file picker (mismo handler que el botón subir)
        if ((e.key === 'Enter' || e.key === ' ') && !kf?.blob) {
          e.preventDefault();
          onUpload();
        }
      }}
      className={cn(
        'bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 transition-all',
        status === 'approved' && 'border-emerald-500/40',
        kf?.blob && 'ring-1 ring-sky-500/10',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <i className={`fa-solid ${iconForRole(role)} text-sky-400`} /> {label}
            {isOut && (
              <span className="text-[10px] bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 px-2 py-0.5 rounded uppercase">
                Auto
              </span>
            )}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">{description}</p>
        </div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border', STATUS_COLOR[status])}>
          {STATUS_LABEL[status]}
        </span>
      </header>

      {/* Thumbnail / dropzone */}
      <div className="relative h-44 rounded-xl overflow-hidden bg-slate-950 border border-dashed border-slate-800">
        {kf?.blob ? (
          <img
            src={URL.createObjectURL(kf.blob)}
            alt={label}
            className="object-cover w-full h-full"
            onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
          />
        ) : (
          <button
            type="button"
            onClick={onUpload}
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-sky-400 transition-colors"
          >
            <i className="fa-solid fa-cloud-arrow-up text-2xl" />
            <span className="text-xs font-semibold">Subir foto {label.toLowerCase()}</span>
          </button>
        )}
        {kf?.blob && (
          <button
            type="button"
            onClick={onUpload}
            className="absolute top-2 right-2 bg-slate-900/85 backdrop-blur border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800"
          >
            Reemplazar
          </button>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        {needsAnalysis && (
          <Button variant="secondary" size="sm" icon="fa-magnifying-glass" onClick={handleAnalyze}>
            Analizar
          </Button>
        )}
        {showApproveBtn && (
          <Button variant="success" size="sm" icon="fa-check" onClick={handleApprove}>
            Aprobar
          </Button>
        )}
        {canGenerateClip && (
          <Button variant="primary" size="sm" icon="fa-wand-magic-sparkles" onClick={handleGenerateClip}>
            Generar clip
          </Button>
        )}
        {canEditGranular && (
          <Button
            variant="secondary"
            size="sm"
            icon="fa-sliders"
            onClick={handleEditGranular}
            data-testid={`edit-granular-${role}`}
          >
            Editar nodo
          </Button>
        )}
      </div>

      {/* Intent (in-camera hint) — S5 §Tarea 5.1 fix: componente con debounce */}
      {showIntent && kf && (
        <div className="pt-2 border-t border-slate-800">
          <IntentTextarea
            keyframeId={kf.id}
            initialValue={kf.humanIntent ?? ''}
            rows={2}
            placeholder="Ej: abrir a motor sucio desenfocado"
          />
        </div>
      )}

      {/* Visual analysis expandable */}
      {kf?.visualAnalysis && (
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
          >
            <i className={`fa-solid ${expanded ? 'fa-eye-slash' : 'fa-eye'}`} />
            {expanded ? 'Ocultar' : 'Ver'} análisis visual
          </button>
          {expanded && (
            <pre className="mt-2 text-[10px] bg-slate-950 rounded-lg p-3 text-slate-300 overflow-auto max-h-48 border border-slate-800">
{`Sujeto: ${kf.visualAnalysis.subject}
Entorno: ${kf.visualAnalysis.environment}
Iluminación: ${kf.visualAnalysis.lighting}
Composición: ${kf.visualAnalysis.composition}
Paleta: ${kf.visualAnalysis.colorPalette.join(', ')}
Texturas: ${kf.visualAnalysis.textures.join(', ')}
Cámara: ${kf.visualAnalysis.cameraPosition}, DoF ${kf.visualAnalysis.depthOfField}
Confianza: ${kf.visualAnalysis.confidence.toFixed(2)}`}
            </pre>
          )}
        </div>
      )}
    </article>
  );
});

function iconForRole(role: KeyframeRole): string {
  if (role === 'bumper_start') return 'fa-flag';
  if (role.endsWith('_out')) return 'fa-wand-magic-sparkles';
  if (role === 'cta_final') return 'fa-bullseye';
  return 'fa-image';
}

interface StoryboardProps {
  briefReady: boolean;
}

export function KeyframeStoryboard({ briefReady }: StoryboardProps) {
  const keyframes = useProjectStore((s) => s.keyframes);
  const uploadKeyframeImage = useProjectStore((s) => s.uploadKeyframeImage);
  const addToast = useUIStore((s) => s.addToast);

  const onPickFile = useCallback(
    (role: KeyframeRole) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          await uploadKeyframeImage(role, file);
          addToast({ kind: 'success', message: `Imagen subida a ${role}.` });
          // S5 §Tarea 5.1 fix: auto-analizar después de subir para que el prompt
          // approval gate tenga el visualAnalysis disponible sin click manual.
          addToast({ kind: 'info', message: `Analizando ${role} con Gemini Vision...` });
          try {
            const { analyzeImageForVeo } = await import('@/services/gemini/imageAnalysis');
            const updatedKf = useProjectStore.getState().keyframes.get(`kf_${role}`);
            if (updatedKf?.blob) {
              const va = await analyzeImageForVeo(updatedKf.blob);
              useProjectStore.setState((s) => {
                const cur = s.keyframes.get(`kf_${role}`);
                if (cur) {
                  const next = new Map(s.keyframes);
                  next.set(`kf_${role}`, { ...cur, visualAnalysis: va, status: 'analyzed' });
                  return { keyframes: next };
                }
                return s;
              });
              addToast({ kind: 'success', message: `${role} analizada. Lista para generar clip.` });
            }
          } catch (e) {
            addToast({ kind: 'warning', message: `Análisis falló: ${(e as Error).message}. Puedes reintentar con el botón "Analizar".` });
          }
        } catch (e) {
          addToast({ kind: 'error', message: (e as Error).message ?? 'Error al subir' });
        }
      };
      input.click();
    },
    [uploadKeyframeImage, addToast],
  );

  if (!briefReady) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-slate-400 text-sm">
        Completa el Brief Wizard primero para empezar a subir keyframes.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <i className="fa-solid fa-film text-fuchsia-400" /> Keyframe Storyboard
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              5 categorías AIDA · Sube fotos reales o genera OUTs automáticos con <span className="text-fuchsia-300">Imagen 3</span>.
            </p>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <i className="fa-solid fa-circle-info" />
            📁 Generales = fotos del negocio · 🎬 AIDA = IN real + OUT auto
          </div>
        </header>
      </div>

      <div className="flex flex-col gap-6">
        {STORYBOARD_STRUCTURE.map((category) => {
          const categoryKeyframes = category.slots
            .map((slot) => {
              const kf = keyframes.get(`kf_${slot.role}`);
              const meta = STORYBOARD_SLOTS.find((s) => s.role === slot.role);
              return {
                role: slot.role,
                kf,
                label: slot.label,
                description: slot.hint,
                metaHint: meta?.description,
                autoGenerate: slot.autoGenerate ?? false,
              };
            })
            .filter((item) => !item.autoGenerate || true); // incluye todos, auto-generados también

          return (
            <section
              key={category.id}
              data-testid={`category-${category.id}`}
              className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col gap-3"
              aria-labelledby={`category-${category.id}-heading`}
            >
              {/* Header de categoría */}
              <header className="flex items-start justify-between gap-3 pb-2 border-b border-slate-800">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0',
                      category.accent === 'sky' && 'bg-sky-500/15 text-sky-300',
                      category.accent === 'emerald' && 'bg-emerald-500/15 text-emerald-300',
                      category.accent === 'indigo' && 'bg-indigo-500/15 text-indigo-300',
                      category.accent === 'fuchsia' && 'bg-fuchsia-500/15 text-fuchsia-300',
                      category.accent === 'rose' && 'bg-rose-500/15 text-rose-300',
                    )}
                    aria-hidden="true"
                  >
                    {category.emoji}
                  </div>
                  <div>
                    <h3
                      id={`category-${category.id}-heading`}
                      className="text-base font-bold text-white"
                    >
                      {category.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                      {category.description}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-wider px-2 py-1 rounded border flex-shrink-0',
                    category.accent === 'sky' && 'bg-sky-500/10 border-sky-500/30 text-sky-300',
                    category.accent === 'emerald' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
                    category.accent === 'indigo' && 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
                    category.accent === 'fuchsia' && 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300',
                    category.accent === 'rose' && 'bg-rose-500/10 border-rose-500/30 text-rose-300',
                  )}
                >
                  {category.slots.length} slots
                </span>
              </header>

              {/* Grid de slots de esta categoría */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryKeyframes.map((item) => (
                  <KeyframeSlotView
                    key={item.role}
                    role={item.role}
                    label={item.label}
                    description={item.description}
                    kf={item.kf}
                    onUpload={() => onPickFile(item.role)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
