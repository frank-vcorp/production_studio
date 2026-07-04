/**
 * Tests de useGuidedTour hook + wrapper.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.1.
 * ID: IMPL-20260704-05.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGuidedTour, type TourStep } from '@/components/landing/GuidedTour';

// Mock driver.js — capturamos la config que se le pasa
const driveMock = vi.fn();
const driverMock = vi.fn((config: unknown) => ({
  drive: driveMock,
  destroy: vi.fn(),
  isActive: () => false,
  moveNext: vi.fn(),
  movePrevious: vi.fn(),
  hasNextStep: vi.fn(),
  hasPreviousStep: vi.fn(),
  getActiveIndex: vi.fn(),
  refresh: vi.fn(),
  getConfig: () => config,
}));

vi.mock('driver.js', () => ({
  driver: (config: unknown) => driverMock(config),
}));

vi.mock('driver.js/dist/driver.css', () => ({}));

const STEPS: TourStep[] = [
  { selector: '[data-test="a"]', title: 'A', description: 'desc a' },
  { selector: '[data-test="b"]', title: 'B', description: 'desc b', position: 'top' },
];

describe('useGuidedTour', () => {
  beforeEach(() => {
    driverMock.mockClear();
    driveMock.mockClear();
  });

  it('start() llama driver() con config mapeada de los steps', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useGuidedTour(STEPS, onComplete));

    act(() => {
      result.current.start();
    });

    expect(driverMock).toHaveBeenCalledTimes(1);
    const config = driverMock.mock.calls[0]?.[0] as {
      nextBtnText: string;
      prevBtnText: string;
      doneBtnText: string;
      showProgress: boolean;
      animate: boolean;
      steps: Array<{ element: string; popover: { title: string; position: string } }>;
    };
    expect(config.nextBtnText).toBe('Siguiente →');
    expect(config.prevBtnText).toBe('← Atrás');
    expect(config.doneBtnText).toBe('¡Listo!');
    expect(config.showProgress).toBe(true);
    expect(config.animate).toBe(true);
    expect(config.steps).toHaveLength(2);
    expect(config.steps[0]?.element).toBe('[data-test="a"]');
    expect(config.steps[0]?.popover.title).toBe('A');
    expect(config.steps[1]?.popover.position).toBe('top');
  });

  it('start() llama instance.drive() para arrancar', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useGuidedTour(STEPS, onComplete));

    act(() => {
      result.current.start();
    });

    expect(driveMock).toHaveBeenCalledTimes(1);
    expect(result.current.hasStarted()).toBe(true);
  });

  it('onDestroyed de la config invoca onComplete del hook', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useGuidedTour(STEPS, onComplete));

    act(() => {
      result.current.start();
    });

    const config = driverMock.mock.calls[0]?.[0] as { onDestroyed: () => void };
    expect(typeof config.onDestroyed).toBe('function');

    act(() => {
      config.onDestroyed();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('position por defecto es "auto" si no se especifica', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useGuidedTour(STEPS, onComplete));

    act(() => {
      result.current.start();
    });

    const config = driverMock.mock.calls[0]?.[0] as {
      steps: Array<{ popover: { position: string } }>;
    };
    expect(config.steps[0]?.popover.position).toBe('auto');
  });
});