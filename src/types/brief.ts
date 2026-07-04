/**
 * Tipos del Brief universal — toda la metadata de negocio/servicios/visión
 * que el usuario completa en el wizard de 3 pasos.
 * Spec: SPEC-S1-FOUNDATION §1.3 + ARCH-20260703-01.
 */

/** Sectores soportados en S1 (extensible en S5 templates) */
export type BusinessSector =
  | 'automotriz'
  | 'estetica'
  | 'comida'
  | 'salud'
  | 'inmobiliaria'
  | 'educacion'
  | 'tecnologia'
  | 'retail'
  | 'otro';

/** Identidad del negocio */
export interface BusinessIdentity {
  name: string;
  acronym?: string;
  slogan?: string;
  description: string;
  sector: BusinessSector;
  /** Buyer persona: a quién va dirigido el spot */
  audience: string;
  /** Qué te hace diferente vs competencia */
  differentiators: string[];
  /** Logo subido por usuario como Blob (null si aún no) */
  logoBlob?: Blob | null;
  logoMimeType?: string | null;
  /** Contacto para CTA final */
  contactPhone?: string;
  contactLocation?: string;
  contactWhatsapp?: string;
}

/** Un servicio a publicitar */
export interface ServiceToAdvertise {
  id: string;
  name: string;
  description: string;
  price?: string;
  keyBenefit: string;
  /** Etapa AIDA narrativa del servicio (escritas por usuario en step 3) */
  stages: AidaStageDescription;
}

/** 4 etapas AIDA con texto natural por nodo */
export interface AidaStageDescription {
  /** Gancho — primeros ~5s (corresponde a nodo 'atencion') */
  attention: string;
  /** Mostrar credibilidad/proceso — 5-15s (nodo 'interes') */
  interest: string;
  /** Beneficio tangible / resultado — 15-25s (nodo 'deseo') */
  desire: string;
  /** Llamado a la acción final (nodo 'accion' + 'cta') */
  action: string;
}

/** Visión global del spot: tono, música, pacing, restricciones */
export interface GlobalAdVision {
  style: string;
  musicMood: string;
  pacing: 'rapido' | 'balanceado' | 'cinematico';
  toneKeywords: string[];
  avoidKeywords: string[];
  /** Paleta sugerida (hex) opcional */
  suggestedPalette?: string[];
}

/** Brief maestro completo cargado en projectStore */
export interface MasterBrief {
  id: string;
  business: BusinessIdentity;
  services: ServiceToAdvertise[];
  globalVision: GlobalAdVision;
  createdAt: number;
  updatedAt: number;
}

/** Tipo discriminante de las 4 etapas AIDA */
export type AidaStageKey = keyof AidaStageDescription;
