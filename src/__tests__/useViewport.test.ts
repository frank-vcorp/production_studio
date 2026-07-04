/**
 * Tests del hook useViewport.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.4.
 * ID: IMPL-20260704-05.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewport } from '@/hooks/useViewport';

function setWindowSize(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
  window.dispatchEvent(new Event('resize'));
}

describe('useViewport', () => {
  beforeEach(() => {
    setWindowSize(1280, 800);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inicializa con window.innerWidth y window.innerHeight', () => {
    setWindowSize(1024, 768);
    const { result } = renderHook(() => useViewport());
    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
    expect(result.current.breakpoint).toBe('desktop');
  });

  it('resize event actualiza width y breakpoint', () => {
    const { result } = renderHook(() => useViewport());
    expect(result.current.breakpoint).toBe('desktop');

    act(() => {
      setWindowSize(500, 600);
    });
    expect(result.current.width).toBe(500);
    expect(result.current.breakpoint).toBe('mobile');
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);

    act(() => {
      setWindowSize(800, 600);
    });
    expect(result.current.breakpoint).toBe('tablet');
    expect(result.current.isTablet).toBe(true);
  });

  it('breakpoint retorna mobile/tablet/desktop según thresholds (640, 1024)', () => {
    const { result } = renderHook(() => useViewport());

    act(() => setWindowSize(639, 800));
    expect(result.current.breakpoint).toBe('mobile');

    act(() => setWindowSize(640, 800));
    expect(result.current.breakpoint).toBe('tablet');

    act(() => setWindowSize(1023, 800));
    expect(result.current.breakpoint).toBe('tablet');

    act(() => setWindowSize(1024, 800));
    expect(result.current.breakpoint).toBe('desktop');
  });
});