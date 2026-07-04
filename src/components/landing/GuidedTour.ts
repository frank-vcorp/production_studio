/**
 * useGuidedTour — wrapper sobre Driver.js para tours guiados accesibles.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.1.
 *
 * Driver.js v1.6+ expone `driver(config)` que retorna instancia con `.drive()`.
 * El callback `onDestroyed` se dispara cuando el usuario cierra (X, click fuera
 * o termina el último paso).
 *
 * NOTA: Driver.js maneja internamente el ciclo de vida del popover; no
 * requiere cleanup manual en React porque la librería monta/desmonta su
 * propio DOM. Mantenemos `instance` por si necesitamos `.destroy()` futuro.
 *
 * ID: IMPL-20260704-05.
 */

import { useCallback, useRef } from 'react';
import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export interface TourStep {
  selector: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export interface GuidedTourHandle {
  start: () => void;
  /** Para tests: indica si se llamó drive() al menos una vez. */
  hasStarted: () => boolean;
}

export function useGuidedTour(
  steps: TourStep[],
  onComplete: () => void,
): GuidedTourHandle {
  const instanceRef = useRef<Driver | null>(null);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    const driveSteps: DriveStep[] = steps.map((step) => ({
      element: step.selector,
      popover: {
        title: step.title,
        description: step.description,
        position: step.position ?? 'auto',
      },
      onHighlightStarted: (el) => {
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    }));

    const drv = driver({
      showProgress: true,
      animate: true,
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Atrás',
      doneBtnText: '¡Listo!',
      steps: driveSteps,
      onDestroyed: () => {
        instanceRef.current = null;
        onComplete();
      },
    });

    instanceRef.current = drv;
    startedRef.current = true;
    drv.drive();
  }, [steps, onComplete]);

  return {
    start,
    hasStarted: () => startedRef.current,
  };
}