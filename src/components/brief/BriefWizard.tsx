import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import { v4 as uuidv4 } from 'uuid';
import type {
  MasterBrief,
  BusinessIdentity,
  BusinessSector,
  ServiceToAdvertise,
  GlobalAdVision,
  AidaStageKey,
} from '@/types/brief';

const STEPS = [
  { id: 0, label: 'Negocio', icon: 'fa-shop' },
  { id: 1, label: 'Servicios', icon: 'fa-bullhorn' },
  { id: 2, label: 'Estilo', icon: 'fa-palette' },
];

const SECTORS: Array<{ value: BusinessSector; label: string }> = [
  { value: 'automotriz', label: 'Automotriz' },
  { value: 'estetica', label: 'Estética' },
  { value: 'comida', label: 'Comida' },
  { value: 'salud', label: 'Salud' },
  { value: 'inmobiliaria', label: 'Inmobiliaria' },
  { value: 'educacion', label: 'Educación' },
  { value: 'tecnologia', label: 'Tecnología' },
  { value: 'retail', label: 'Retail' },
  { value: 'otro', label: 'Otro' },
];

const DEFAULT_VISION: GlobalAdVision = {
  style: 'Cinematográfico moderno, contrastes marcados, transiciones suaves.',
  musicMood: 'Instrumental upbeat, energizante, sin letra.',
  pacing: 'balanceado',
  toneKeywords: ['cercano', 'profesional', 'aspiracional'],
  avoidKeywords: ['texto en pantalla', 'marcas genéricas'],
};

const DEFAULT_BUSINESS: BusinessIdentity = {
  name: '',
  acronym: '',
  slogan: '',
  description: '',
  sector: 'otro',
  audience: '',
  differentiators: [],
  logoBlob: null,
  contactPhone: '',
  contactLocation: '',
};

const STORAGE_KEY = 'bridge.brief.draft';

interface Draft {
  step: number;
  business: BusinessIdentity;
  services: ServiceToAdvertise[];
  vision: GlobalAdVision;
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('no draft');
    return JSON.parse(raw) as Draft;
  } catch {
    return {
      step: 0,
      business: { ...DEFAULT_BUSINESS },
      services: [],
      vision: { ...DEFAULT_VISION },
    };
  }
}

function persistDraft(d: Draft): void {
  try {
    const safe: Draft = { ...d, business: { ...d.business, logoBlob: null } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // ignore quota errors
  }
}

export function BriefWizard() {
  const storeBrief = useProjectStore((s) => s.brief);
  const loadBrief = useProjectStore((s) => s.loadBrief);
  const setStep = useUIStore((s) => s.setStep);
  const addToast = useUIStore((s) => s.addToast);
  const [draft, setDraft] = useState<Draft>(() => {
    // S5 bug fix: sincronizar con storeBrief si tiene servicios y draft está vacío.
    // Caso: usuario selecciona sector template → loadBrief(seeded) → storeBrief.services = 3.
    // Sin este sync, el wizard muestra "Aún no agregas servicios" aunque el store tenga 3.
    const localDraft = loadDraft();
    if (localDraft.services.length === 0) {
      const persistedBrief = useProjectStore.getState().brief;
      if (persistedBrief && persistedBrief.services.length > 0) {
        return {
          step: localDraft.step,
          business: persistedBrief.business,
          services: persistedBrief.services,
          vision: persistedBrief.globalVision,
        };
      }
    }
    return localDraft;
  });
  const [step, setLocalStep] = useState<number>(draft.step);
  const [dirty, setDirty] = useState(false);

  // S5 bug fix: si el store recibe un sector template DESPUÉS de montar el wizard,
  // sincronizar el draft con los nuevos servicios.
  useEffect(() => {
    if (
      storeBrief &&
      storeBrief.services.length > 0 &&
      draft.services.length === 0 &&
      !dirty
    ) {
      setDraft({
        step,
        business: storeBrief.business,
        services: storeBrief.services,
        vision: storeBrief.globalVision,
      });
    }
  }, [storeBrief, draft.services.length, dirty, step]);

  useEffect(() => {
    if (dirty) {
      const next = { ...draft, step };
      setDraft(next);
      persistDraft(next);
      setDirty(false);
    }
  }, [dirty, draft, step]);

  const setBusiness = (partial: Partial<BusinessIdentity>) => {
    setDraft((d) => ({ ...d, business: { ...d.business, ...partial } }));
    setDirty(true);
  };

  const setVision = (partial: Partial<GlobalAdVision>) => {
    setDraft((d) => ({ ...d, vision: { ...d.vision, ...partial } }));
    setDirty(true);
  };

  const addService = () => {
    const newSvc: ServiceToAdvertise = {
      id: `svc_${uuidv4().slice(0, 6)}`,
      name: '',
      description: '',
      keyBenefit: '',
      stages: { attention: '', interest: '', desire: '', action: '' },
    };
    setDraft((d) => ({ ...d, services: [...d.services, newSvc] }));
    setDirty(true);
  };

  const updateService = (id: string, partial: Partial<ServiceToAdvertise>) => {
    setDraft((d) => ({
      ...d,
      services: d.services.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    }));
    setDirty(true);
  };

  const removeService = (id: string) => {
    setDraft((d) => ({ ...d, services: d.services.filter((s) => s.id !== id) }));
    setDirty(true);
  };

  const updateStage = (serviceId: string, stage: AidaStageKey, description: string) => {
    setDraft((d) => ({
      ...d,
      services: d.services.map((s) =>
        s.id === serviceId ? { ...s, stages: { ...s.stages, [stage]: description } } : s,
      ),
    }));
    setDirty(true);
  };

  const next = () => {
    if (step === 0 && !draft.business.name) {
      addToast({ kind: 'warning', message: 'Ingresa el nombre del negocio antes de continuar.' });
      return;
    }
    if (step < 2) {
      setLocalStep(step + 1);
      setDirty(true);
    } else {
      finish();
    }
  };

  const back = () => {
    if (step > 0) setLocalStep(step - 1);
  };

  const finish = () => {
    if (draft.services.length === 0) {
      addToast({ kind: 'warning', message: 'Agrega al menos un servicio.' });
      setLocalStep(1);
      return;
    }
    const brief: MasterBrief = {
      id: `brief_${uuidv4().slice(0, 8)}`,
      business: draft.business,
      services: draft.services,
      globalVision: draft.vision,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    loadBrief(brief);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    addToast({ kind: 'success', message: 'Brief guardado. Pasamos al storyboard.' });
    setStep('storyboard');
  };

  return (
    <section className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-clipboard-list text-sky-400" /> Brief Wizard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            3 pasos · ~5 min. Tu información se guarda localmente.
          </p>
        </div>
        <ol className="flex items-center gap-2" role="tablist" aria-label="Pasos del wizard">
          {STEPS.map((s) => (
            <li
              key={s.id}
              role="tab"
              aria-selected={step === s.id}
              aria-current={step === s.id ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border',
                step === s.id
                  ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                  : step > s.id
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300',
              )}
            >
              <i className={`fa-solid ${s.icon}`} aria-hidden />
              {s.label}
            </li>
          ))}
        </ol>
      </header>

      {step === 0 && (
        <div data-tour="brief-step-business">
          <StepBusiness
            business={draft.business}
            onChange={setBusiness}
          />
        </div>
      )}
      {step === 1 && (
        <div data-tour="brief-step-services">
          {/* S5 §Tarea 5.1 fix: explicar que las fotos van en Storyboard, no aquí */}
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3 mb-4 flex items-start gap-2 text-xs text-sky-200">
            <i className="fa-solid fa-circle-info text-sky-400 mt-0.5" aria-hidden="true"></i>
            <div>
              <strong>Aquí defines los servicios y su copy AIDA</strong> (Atención / Interés / Deseo / Acción).
              Las <strong>fotos reales del negocio</strong> se suben en el siguiente paso: <em>Storyboard</em>.
            </div>
          </div>
          <StepServices
            services={draft.services}
            onAdd={addService}
            onUpdate={updateService}
            onRemove={removeService}
            onUpdateStage={updateStage}
          />
        </div>
      )}
      {step === 2 && (
        <div data-tour="brief-step-vision">
          <StepVision vision={draft.vision} onChange={setVision} />
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
        <div className="text-xs text-slate-500">
          Paso {step + 1} de {STEPS.length}
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="md" onClick={back} disabled={step === 0}>
            Atrás
          </Button>
          <Button variant="primary" size="md" onClick={next} icon={step === 2 ? 'fa-rocket' : 'fa-arrow-right'}>
            {step === 2 ? 'Guardar y continuar al Storyboard' : 'Siguiente'}
          </Button>
        </div>
      </footer>
    </section>
  );
}

interface StepBusinessProps {
  business: BusinessIdentity;
  onChange: (partial: Partial<BusinessIdentity>) => void;
}

function StepBusiness({ business, onChange }: StepBusinessProps) {
  const [differentiatorsText, setDifferentiatorsText] = useState(business.differentiators.join('\n'));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Nombre comercial" required>
        <input
          type="text"
          value={business.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ej: CP Automotriz"
          className="input"
        />
      </Field>
      <Field label="Acrónimo / Sigla">
        <input
          type="text"
          value={business.acronym ?? ''}
          onChange={(e) => onChange({ acronym: e.target.value })}
          placeholder="CPA"
          className="input"
        />
      </Field>
      <Field label="Slogan principal" full>
        <input
          type="text"
          value={business.slogan ?? ''}
          onChange={(e) => onChange({ slogan: e.target.value })}
          placeholder="Colisión y Pintura Premium"
          className="input"
        />
      </Field>
      <Field label="Descripción del negocio" full>
        <textarea
          value={business.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="¿A qué se dedica el negocio? ¿Qué problema resuelves?"
          rows={4}
          className="input resize-y"
        />
      </Field>
      <Field label="Sector">
        <select
          value={business.sector}
          onChange={(e) => onChange({ sector: e.target.value as BusinessSector })}
          className="input"
        >
          {SECTORS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Audiencia / buyer persona">
        <input
          type="text"
          value={business.audience}
          onChange={(e) => onChange({ audience: e.target.value })}
          placeholder="Dueños de autos en Querétaro"
          className="input"
        />
      </Field>
      <Field label="Diferenciadores (uno por línea)" full>
        <textarea
          value={differentiatorsText}
          onChange={(e) => {
            setDifferentiatorsText(e.target.value);
            onChange({ differentiators: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });
          }}
          placeholder="Cabina presurizada"
          rows={3}
          className="input resize-y"
        />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 col-span-full">
        <Field label="WhatsApp">
          <input
            type="tel"
            value={business.contactWhatsapp ?? ''}
            onChange={(e) => onChange({ contactWhatsapp: e.target.value })}
            placeholder="+52 442 704 3564"
            className="input"
          />
        </Field>
        <Field label="Ubicación">
          <input
            type="text"
            value={business.contactLocation ?? ''}
            onChange={(e) => onChange({ contactLocation: e.target.value })}
            placeholder="Querétaro, Qro."
            className="input"
          />
        </Field>
      </div>
    </div>
  );
}

interface StepServicesProps {
  services: ServiceToAdvertise[];
  onAdd: () => void;
  onUpdate: (id: string, partial: Partial<ServiceToAdvertise>) => void;
  onRemove: (id: string) => void;
  onUpdateStage: (serviceId: string, stage: AidaStageKey, description: string) => void;
}

function StepServices({ services, onAdd, onUpdate, onRemove, onUpdateStage }: StepServicesProps) {
  return (
    <div className="flex flex-col gap-4">
      {services.length === 0 && (
        <div className="border border-dashed border-slate-700 rounded-xl p-6 text-center text-sm text-slate-400">
          Aún no agregas servicios. Empieza con tu servicio principal.
        </div>
      )}
      {services.map((svc, idx) => (
        <article
          key={svc.id}
          className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3"
        >
          <header className="flex items-center justify-between gap-3">
            <div className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              Servicio #{idx + 1}
            </div>
            <button
              type="button"
              onClick={() => onRemove(svc.id)}
              className="text-slate-500 hover:text-rose-400 text-xs"
              aria-label={`Eliminar servicio ${svc.name}`}
            >
              <i className="fa-solid fa-trash-can" /> Eliminar
            </button>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nombre del servicio">
              <input
                type="text"
                value={svc.name}
                onChange={(e) => onUpdate(svc.id, { name: e.target.value })}
                placeholder="Hojalatería y Pintura"
                className="input"
              />
            </Field>
            <Field label="Beneficio clave">
              <input
                type="text"
                value={svc.keyBenefit}
                onChange={(e) => onUpdate(svc.id, { keyBenefit: e.target.value })}
                placeholder="Restauración exacta color de fábrica"
                className="input"
              />
            </Field>
            <Field label="Descripción" full>
              <textarea
                value={svc.description}
                onChange={(e) => onUpdate(svc.id, { description: e.target.value })}
                rows={2}
                className="input resize-y"
              />
            </Field>
            <Field label="Precio referencial">
              <input
                type="text"
                value={svc.price ?? ''}
                onChange={(e) => onUpdate(svc.id, { price: e.target.value })}
                placeholder="Desde $X"
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <StageField
              label="Atención (gancho 5s)"
              value={svc.stages.attention}
              onChange={(v) => onUpdateStage(svc.id, 'attention', v)}
              placeholder="¿Tu auto tiene manchas difíciles?"
            />
            <StageField
              label="Interés (5-15s)"
              value={svc.stages.interest}
              onChange={(v) => onUpdateStage(svc.id, 'interest', v)}
              placeholder="Abrimos cabina presurizada con lavados profundos"
            />
            <StageField
              label="Deseo (15-25s)"
              value={svc.stages.desire}
              onChange={(v) => onUpdateStage(svc.id, 'desire', v)}
              placeholder="Recuperamos textura original de fábrica"
            />
            <StageField
              label="Acción (CTA)"
              value={svc.stages.action}
              onChange={(v) => onUpdateStage(svc.id, 'action', v)}
              placeholder="Agenda tu cotización por WhatsApp hoy"
            />
          </div>
        </article>
      ))}
      <Button variant="secondary" icon="fa-plus" onClick={onAdd}>
        Agregar servicio
      </Button>
    </div>
  );
}

interface StepVisionProps {
  vision: GlobalAdVision;
  onChange: (partial: Partial<GlobalAdVision>) => void;
}

function StepVision({ vision, onChange }: StepVisionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Estilo global" full>
        <textarea
          value={vision.style}
          onChange={(e) => onChange({ style: e.target.value })}
          rows={3}
          className="input resize-y"
          placeholder="Cinematográfico, transiciones suaves, contraste marcado"
        />
      </Field>
      <Field label="Mood musical">
        <input
          type="text"
          value={vision.musicMood}
          onChange={(e) => onChange({ musicMood: e.target.value })}
          placeholder="Instrumental upbeat"
          className="input"
        />
      </Field>
      <Field label="Pacing">
        <select
          value={vision.pacing}
          onChange={(e) => onChange({ pacing: e.target.value as GlobalAdVision['pacing'] })}
          className="input"
        >
          <option value="rapido">Rápido</option>
          <option value="balanceado">Balanceado</option>
          <option value="cinematico">Cinematográfico</option>
        </select>
      </Field>
      <Field label="Tono (keywords, separar comas)" full>
        <input
          type="text"
          value={vision.toneKeywords.join(', ')}
          onChange={(e) =>
            onChange({ toneKeywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
          }
          className="input"
        />
      </Field>
      <Field label="EVITAR (keywords, separar comas)" full>
        <input
          type="text"
          value={vision.avoidKeywords.join(', ')}
          onChange={(e) =>
            onChange({ avoidKeywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
          }
          className="input"
        />
      </Field>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}

export function Field({ label, required, full, children }: FieldProps) {
  return (
    <label className={cn('flex flex-col gap-1', full && 'col-span-full')}>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

interface StageFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function StageField({ label, value, onChange, placeholder }: StageFieldProps) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="input resize-y"
        placeholder={placeholder}
      />
    </Field>
  );
}
