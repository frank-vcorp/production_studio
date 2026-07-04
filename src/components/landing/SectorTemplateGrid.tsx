/**
 * SectorTemplateGrid — grid visual con los 6 sectores disponibles.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.2.
 *
 * Renderiza 6 botones accesibles (uno por sector) con emoji + nombre +
 * descripción. Cada botón incluye aria-label explícito y data-tour anchor
 * para el tour guiado.
 */

import { SECTOR_TEMPLATES, SECTOR_IDS } from '@/data/sectorTemplates';
import type { SectorId } from '@/types/sector';
import { cn } from '@/utils/cn';

export interface SectorTemplateGridProps {
  onSelect: (sector: SectorId) => void;
  className?: string;
}

export function SectorTemplateGrid({ onSelect, className }: SectorTemplateGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 md:grid-cols-3 gap-3',
        className,
      )}
      role="group"
      aria-label="Plantillas de sector disponibles"
    >
      {SECTOR_IDS.map((id) => {
        const template = SECTOR_TEMPLATES[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            data-tour={`sector-${id}`}
            data-testid={`sector-template-${id}`}
            aria-label={`Seleccionar plantilla de ${template.name}`}
            className={cn(
              'bg-slate-900/80 border border-slate-800 rounded-xl p-4 md:p-5 text-left',
              'hover:border-sky-500/60 hover:bg-slate-900 transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
            )}
          >
            <div className="text-3xl mb-2" aria-hidden="true">
              {template.emoji}
            </div>
            <h3 className="text-sm font-bold text-white">{template.name}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-snug">
              {template.description}
            </p>
            {template.defaultServices.length > 0 && (
              <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wider font-bold">
                {template.defaultServices.length} servicios pre-llenados
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}