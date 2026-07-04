/**
 * useViewport — breakpoint detection con resize listener.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.4.
 *
 * Breakpoints:
 *   - mobile:  width < 640
 *   - tablet:  640 <= width < 1024
 *   - desktop: width >= 1024
 *
 * El listener se limpia en unmount. Retorna también `height` para
 * componentes que necesiten ambos valores (ej. BottomNav safe-area).
 */

import { useEffect, useState } from 'react';

export type ViewportBreakpoint = 'mobile' | 'tablet' | 'desktop';

export interface ViewportInfo {
  breakpoint: ViewportBreakpoint;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

function getBreakpoint(width: number): ViewportBreakpoint {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function useViewport(): ViewportInfo {
  const [width, setWidth] = useState<number>(
    () => (typeof window !== 'undefined' ? window.innerWidth : 1280),
  );
  const [height, setHeight] = useState<number>(
    () => (typeof window !== 'undefined' ? window.innerHeight : 720),
  );

  useEffect(() => {
    const handler = (): void => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const breakpoint = getBreakpoint(width);

  return {
    breakpoint,
    width,
    height,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
  };
}