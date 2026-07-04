/**
 * SkipLink — enlace "Saltar al contenido principal" para usuarios de teclado.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.5.
 *
 * Es el PRIMER elemento tabbable de la página (debe montarse antes del header).
 * Por defecto está oculto (sr-only); al recibir foco se vuelve visible.
 * El href apunta al `<main id="main-content">` que montamos en App.tsx.
 */

import { cn } from '@/utils/cn';

export interface SkipLinkProps {
  href?: string;
  label?: string;
  className?: string;
}

export function SkipLink({
  href = '#main-content',
  label = 'Saltar al contenido principal',
  className,
}: SkipLinkProps) {
  return (
    <nav
      role="navigation"
      aria-label="Accesibilidad"
      className="contents"
    >
      <a
        href={href}
        data-testid="skip-link"
        className={cn(
          'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100]',
          'focus:px-4 focus:py-2 focus:bg-sky-500 focus:text-slate-950 focus:rounded-lg',
          'focus:font-bold focus:shadow-lg focus:shadow-sky-500/40',
          className,
        )}
      >
        {label}
      </a>
    </nav>
  );
}