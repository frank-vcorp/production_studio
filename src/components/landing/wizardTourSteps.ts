/**
 * Tour predefinido del Brief Wizard (3 pasos): Negocio → Servicios → Estilo/Visión.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.1.
 *
 * Los selectores `data-tour` deben existir en BriefWizard.tsx — se añaden
 * como parte de la integración en Fase 5.
 */

import type { TourStep } from './GuidedTour';

export const WIZARD_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="brief-step-business"]',
    title: '1. Negocio',
    description:
      'Empieza con datos básicos: nombre, descripción y sector. Esto contextualiza toda la generación.',
    position: 'bottom',
  },
  {
    selector: '[data-tour="brief-step-services"]',
    title: '2. Servicios',
    description:
      'Selecciona los servicios a publicitar. Si elegiste un sector, ya hay plantillas pre-llenadas.',
    position: 'bottom',
  },
  {
    selector: '[data-tour="brief-step-vision"]',
    title: '3. Visión Global',
    description:
      'Define el estilo y tono general. Esto se inyectará en todos los prompts visuales.',
    position: 'bottom',
  },
];