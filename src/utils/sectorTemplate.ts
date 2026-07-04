/**
 * applySectorTemplate — toma un SectorId y construye un MasterBrief pre-llenado.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.2.
 *
 * NO llama al store: retorna el brief listo para pasar a loadBrief(brief).
 * Centralizado aquí para que sea fácil de testear sin montar Zustand.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  MasterBrief,
  BusinessIdentity,
  GlobalAdVision,
} from '@/types/brief';
import type { SectorId } from '@/types/sector';
import { getSectorTemplate } from '@/data/sectorTemplates';

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

export function buildEmptyBrief(): MasterBrief {
  const now = Date.now();
  return {
    id: `brief_${uuidv4().slice(0, 8)}`,
    business: { ...DEFAULT_BUSINESS },
    services: [],
    globalVision: { ...DEFAULT_VISION },
    createdAt: now,
    updatedAt: now,
  };
}

export function applySectorTemplate(sector: SectorId): MasterBrief {
  const template = getSectorTemplate(sector);
  const empty = buildEmptyBrief();

  // Mezcla business: defaults del sector + sector forzado
  const business: BusinessIdentity = {
    ...empty.business,
    ...template.defaultBusiness,
    sector: template.id,
  };

  // Visión: defaults del sector + pacing + palette si existen
  const vision: GlobalAdVision = {
    ...empty.globalVision,
    ...template.defaultGlobalVision,
  };

  return {
    ...empty,
    business,
    services: template.defaultServices.map((s) => ({ ...s, stages: { ...s.stages } })),
    globalVision: vision,
    updatedAt: Date.now(),
  };
}