/**
 * Sector templates — plantillas pre-llenadas por industria.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.2.
 *
 * Define 6 sectores (automotriz/estetica/comida/salud/inmobiliaria/otro)
 * con servicios típicos, visión global y copy AIDA por servicio.
 * ID: IMPL-20260704-05.
 */

import type {
  BusinessIdentity,
  ServiceToAdvertise,
  GlobalAdVision,
  AidaStageDescription,
} from './brief';

export type SectorId =
  | 'automotriz'
  | 'estetica'
  | 'comida'
  | 'salud'
  | 'inmobiliaria'
  | 'otro';

export interface SectorTemplate {
  id: SectorId;
  name: string;
  emoji: string;
  description: string;
  defaultBusiness: Partial<BusinessIdentity>;
  defaultServices: ServiceToAdvertise[];
  defaultGlobalVision: Partial<GlobalAdVision>;
  /** Map<serviceId, AidaStageDescription> con copy AIDA por servicio. */
  defaultStages: Record<string, AidaStageDescription>;
}