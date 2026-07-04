/**
 * Tests del SkipLink.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.5.
 * ID: IMPL-20260704-05.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink } from '@/components/common/SkipLink';

describe('SkipLink', () => {
  it('renderiza con href="#main-content" y label accesible', () => {
    render(<SkipLink />);
    const link = screen.getByTestId('skip-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#main-content');
    expect(link).toHaveTextContent(/Saltar al contenido principal/i);
  });

  it('acepta href y label custom', () => {
    render(<SkipLink href="#custom" label="Ir a contenido" />);
    const link = screen.getByTestId('skip-link');
    expect(link).toHaveAttribute('href', '#custom');
    expect(link).toHaveTextContent('Ir a contenido');
  });
});