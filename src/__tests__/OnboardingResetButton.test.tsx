/**
 * Tests del OnboardingResetButton.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.6.
 * ID: IMPL-20260704-05.
 *
 * Mockeamos window.confirm con vi.stubGlobal (más confiable que vi.spyOn
 * sobre window en jsdom cuando hay varias APIs de dialog ya definidas).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingResetButton } from '@/components/landing/OnboardingResetButton';

const confirmMock = vi.fn<(message?: string) => boolean>();

// Mock del projectStore y uiStore
const resetProjectMock = vi.fn();
const resetAllMock = vi.fn();
const resetTourMock = vi.fn();
const addToastMock = vi.fn();

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: (selector: (s: { resetProject: () => void }) => unknown) =>
    selector({ resetProject: resetProjectMock }),
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: (selector: (s: {
    resetAll: () => void;
    resetTour: () => void;
    addToast: (t: unknown) => void;
  }) => unknown) =>
    selector({
      resetAll: resetAllMock,
      resetTour: resetTourMock,
      addToast: addToastMock,
    }),
}));

describe('OnboardingResetButton', () => {
  beforeEach(() => {
    resetProjectMock.mockClear();
    resetAllMock.mockClear();
    resetTourMock.mockClear();
    addToastMock.mockClear();
    confirmMock.mockReset();
    vi.stubGlobal('confirm', confirmMock);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renderiza con aria-label, data-testid y texto "Volver al inicio"', () => {
    render(<OnboardingResetButton />);
    const btn = screen.getByTestId('onboarding-reset');
    expect(btn).toHaveAttribute('aria-label', 'Volver al inicio (reinicia el onboarding)');
    expect(btn).toHaveTextContent(/Volver al inicio/);
  });

  it('click sin confirmar → NO llama reset*, NO limpia localStorage, NO toast', () => {
    confirmMock.mockReturnValue(false);
    render(<OnboardingResetButton />);

    fireEvent.click(screen.getByTestId('onboarding-reset'));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(resetProjectMock).not.toHaveBeenCalled();
    expect(resetAllMock).not.toHaveBeenCalled();
    expect(resetTourMock).not.toHaveBeenCalled();
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it('click confirmado → llama resetProject + resetAll + resetTour + limpia localStorage + toast', () => {
    confirmMock.mockReturnValue(true);
    localStorage.setItem('bridge_telemetry_optin', '1');
    localStorage.setItem('bridge.brief.draft', '{}');

    render(<OnboardingResetButton />);
    fireEvent.click(screen.getByTestId('onboarding-reset'));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(resetProjectMock).toHaveBeenCalledTimes(1);
    expect(resetAllMock).toHaveBeenCalledTimes(1);
    expect(resetTourMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('bridge_telemetry_optin')).toBeNull();
    expect(localStorage.getItem('bridge.brief.draft')).toBeNull();
    expect(addToastMock).toHaveBeenCalledTimes(1);
    expect(addToastMock.mock.calls[0][0]).toMatchObject({
      kind: 'info',
      message: expect.stringMatching(/Onboarding reiniciado/i),
    });
  });
});