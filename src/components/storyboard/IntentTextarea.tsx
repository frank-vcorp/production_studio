/**
 * IntentTextarea — textarea optimizado para "intención humana" (qué quiere
 * el usuario que muestre el clip).
 *
 * S5 §Tarea 5.1 fix: antes el textarea estaba conectado directamente al
 * projectStore, lo que causaba escritura a IndexedDB en cada keystroke
 * (SÍ genera latencia perceptible, especialmente en Mac/Safari).
 *
 * Ahora usa local state con debounce de 300ms antes de sincronizar con
 * el store. El usuario ve respuesta instantánea, IDB se actualiza en batch.
 */
import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';

interface IntentTextareaProps {
  keyframeId: string;
  initialValue: string;
  className?: string;
  rows?: number;
  placeholder?: string;
  label?: string;
  hint?: string;
}

export function IntentTextarea({
  keyframeId,
  initialValue,
  className = '',
  rows = 2,
  placeholder,
  label = '¿Qué quieres que se vea en este clip?',
  hint = 'Describe en lenguaje natural qué quieres comunicar. Ej: "que se vea un filtro de aceite con grasa, primer plano"',
}: IntentTextareaProps) {
  // Estado LOCAL para typing instantáneo
  const [localValue, setLocalValue] = useState(initialValue);
  const lastPersistedRef = useRef(initialValue);
  const timerRef = useRef<number | null>(null);

  // Sincronizar si el valor cambia desde fuera (ej: reset, undo, etc.)
  useEffect(() => {
    if (initialValue !== lastPersistedRef.current) {
      setLocalValue(initialValue);
      lastPersistedRef.current = initialValue;
    }
  }, [initialValue]);

  // Cleanup timer en unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue); // ← instantáneo, sin re-render global

    // Debounce: solo escribe a IDB cada 300ms (no en cada keystroke)
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      lastPersistedRef.current = newValue;
      useProjectStore.getState().setKeyframeIntent(keyframeId, newValue);
    }, 300);
  };

  const handleBlur = () => {
    // Flush inmediato al perder foco (no esperar 300ms)
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (localValue !== lastPersistedRef.current) {
      lastPersistedRef.current = localValue;
      useProjectStore.getState().setKeyframeIntent(keyframeId, localValue);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </label>
      <textarea
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={rows}
        className={`input text-xs resize-y ${className}`}
        placeholder={placeholder}
      />
      {hint && (
        <p className="text-[10px] text-slate-500 italic">{hint}</p>
      )}
    </div>
  );
}
