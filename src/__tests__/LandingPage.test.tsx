/**
 * Tests del LandingPage.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.1.
 * ID: IMPL-20260704-05.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from '@/components/landing/LandingPage';

describe('LandingPage', () => {
  it('renderiza hero, subhero, CTA principal y grid de sectores', () => {
    const onCreate = vi.fn();
    const onStartTour = vi.fn();
    const onSelectSector = vi.fn();

    render(
      <LandingPage
        onCreateSpot={onCreate}
        onStartTour={onStartTour}
        onSelectSector={onSelectSector}
        hasSeenTour={false}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: /Bridge Creative Engine/i })).toBeInTheDocument();
    expect(screen.getByText(/100% local/i)).toBeInTheDocument();
    expect(screen.getByTestId('landing-cta-create')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    // 6 sectores
    expect(screen.getByTestId('sector-template-automotriz')).toBeInTheDocument();
    expect(screen.getByTestId('sector-template-otro')).toBeInTheDocument();
  });

  it('click en "Crear mi primer spot" llama onCreateSpot', () => {
    const onCreate = vi.fn();
    render(
      <LandingPage
        onCreateSpot={onCreate}
        onStartTour={vi.fn()}
        onSelectSector={vi.fn()}
        hasSeenTour={false}
      />,
    );

    fireEvent.click(screen.getByTestId('landing-cta-create'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('botón "Iniciar tour guiado" solo aparece si !hasSeenTour', () => {
    const onStartTour = vi.fn();

    // hasSeenTour = false → debe aparecer
    const { rerender } = render(
      <LandingPage
        onCreateSpot={vi.fn()}
        onStartTour={onStartTour}
        onSelectSector={vi.fn()}
        hasSeenTour={false}
      />,
    );
    expect(screen.getByTestId('landing-cta-tour')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('landing-cta-tour'));
    expect(onStartTour).toHaveBeenCalledTimes(1);

    // hasSeenTour = true → NO debe aparecer
    rerender(
      <LandingPage
        onCreateSpot={vi.fn()}
        onStartTour={vi.fn()}
        onSelectSector={vi.fn()}
        hasSeenTour={true}
      />,
    );
    expect(screen.queryByTestId('landing-cta-tour')).not.toBeInTheDocument();
  });
});