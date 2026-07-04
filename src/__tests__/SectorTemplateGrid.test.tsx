/**
 * Tests del SectorTemplateGrid.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.2.
 * ID: IMPL-20260704-05.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectorTemplateGrid } from '@/components/landing/SectorTemplateGrid';

describe('SectorTemplateGrid', () => {
  it('renderiza 6 botones (uno por sector)', () => {
    render(<SectorTemplateGrid onSelect={vi.fn()} />);
    // role="group" con aria-label en contenedor; los botones internos son tabbables
    expect(screen.getByRole('group', { name: /plantillas de sector/i })).toBeInTheDocument();
    const buttons = screen.getAllByRole('button').filter(
      (b) => b.getAttribute('data-testid')?.startsWith('sector-template-'),
    );
    expect(buttons).toHaveLength(6);
  });

  it('click en "Automotriz" llama onSelect con id "automotriz"', () => {
    const onSelect = vi.fn();
    render(<SectorTemplateGrid onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('sector-template-automotriz'));
    expect(onSelect).toHaveBeenCalledWith('automotriz');
  });

  it('cada botón tiene aria-label descriptivo', () => {
    render(<SectorTemplateGrid onSelect={vi.fn()} />);
    for (const sector of ['Automotriz', 'Estética y Belleza', 'Comida y Restaurante', 'Salud y Bienestar', 'Inmobiliaria', 'Otro (manual)']) {
      expect(
        screen.getByLabelText(`Seleccionar plantilla de ${sector}`),
      ).toBeInTheDocument();
    }
  });
});