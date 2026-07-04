/**
 * CostEstimatorModal — modal fullscreen con desglose de costos + ETA + disclaimer.
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.1.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/common/Button';
import { estimateCost, formatCost, formatETA, PRICING_DISCLAIMER } from '@/services/costEstimator';
import { useApiKeysStore } from '@/stores/apiKeysStore';
import type { CostEstimatorInput } from '@/services/costEstimator';
import type { BackgroundJob } from '@/types/jobs';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  input: CostEstimatorInput;
  /** Cuando true, ya hay un lote en curso: muestra "Add to existing batch" en vez de "Start fresh". */
  pendingJobs?: BackgroundJob[];
}

export function CostEstimatorModal({ open, onClose, onConfirm, input, pendingJobs = [] }: Props) {
  const cost = useMemo(() => estimateCost(input), [input]);
  const proxyConnected = useApiKeysStore((s) => s.proxyConnected);
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const hasPending = pendingJobs.some(
    (j) => j.status === 'queued' || j.status === 'active' || j.status === 'paused',
  );
  const etaText = formatETA(cost.estimatedTotalTimeSec);
  const etaMargin = `${formatETA(Math.max(cost.estimatedTotalTimeSec - 60, 0))} – ${formatETA(cost.estimatedTotalTimeSec + 60)}`;

  const handleConfirm = async (): Promise<void> => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-sky-400" /> Estimación de Costo del Lote
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Cerrar"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        {!proxyConnected && (
          <div className="bg-amber-500/10 border border-amber-500/40 text-amber-300 rounded-xl p-3 mb-4 text-xs flex items-start gap-2">
            <i className="fa-solid fa-triangle-exclamation mt-0.5" />
            <div>
              <strong>Proxy no verificado.</strong> El sistema intentará generar el lote de todas formas, pero las
              llamadas a Gemini podrían fallar. Ve a Configuración para reconectar.
            </div>
          </div>
        )}

        <table className="w-full text-sm mb-4">
          <tbody>
            <CostRow
              label={`${cost.videoClips.count}× Clips Veo 3.1 (I2V)`}
              value={cost.videoClips.subtotal}
            />
            <CostRow
              label={`${cost.imageGeneration.count}× Imágenes 3 (OUT auto)`}
              value={cost.imageGeneration.subtotal}
            />
            <CostRow
              label={`1× Voiceover TTS (${cost.tts.durationSec}s)`}
              value={cost.tts.subtotal}
            />
            <CostRow
              label={`1× Token processing (LLM brief, ${cost.llm.tokens} tokens)`}
              value={cost.llm.subtotal}
            />
            <tr className="border-t border-slate-800">
              <td className="py-3 font-bold text-white">TOTAL ESTIMADO</td>
              <td className="py-3 text-right font-bold text-sky-300 text-lg">{formatCost(cost)}</td>
            </tr>
            <tr>
              <td className="py-1 text-xs text-slate-400">
                <i className="fa-regular fa-clock mr-1" />
                ETA TOTAL: {etaMargin} (pricing tier: {cost.pricingTier})
              </td>
              <td className="py-1 text-right text-xs text-slate-500">~{etaText}</td>
            </tr>
          </tbody>
        </table>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-4 text-xs text-slate-400 whitespace-pre-line">
          {PRICING_DISCLAIMER}
        </div>

        {hasPending && (
          <div className="bg-sky-500/10 border border-sky-500/40 text-sky-300 rounded-xl p-3 mb-4 text-xs">
            <i className="fa-solid fa-circle-info mr-1" />
            Ya hay un lote en curso ({pendingJobs.filter((j) => j.status !== 'done' && j.status !== 'fallback_done' && j.status !== 'failed' && j.status !== 'cancelled').length} jobs activos/pendientes).
            Esta acción añadirá nuevos jobs a la cola existente.
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon="fa-wand-magic-sparkles"
            onClick={handleConfirm}
            loading={confirming}
          >
            Confirmar y Generar
          </Button>
        </footer>
      </div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-b border-slate-800/50">
      <td className="py-2 text-slate-300">{label}</td>
      <td className="py-2 text-right text-slate-100 font-mono">${value.toFixed(2)} USD</td>
    </tr>
  );
}