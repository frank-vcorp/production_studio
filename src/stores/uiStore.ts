/**
 * uiStore — estado efímero de UI (no persistido): step actual, toasts, modals.
 *
 * S5 — añade hasSeenTour (persiste en localStorage), showTourOnNextRender
 * (flag para lanzar tour cuando monte el wizard tras LandingPage) y resetAll().
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { UIState, Toast } from '@/types/project';

const TOUR_STORAGE_KEY = 'bridge.hasSeenTour.v1';

function readHasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHasSeenTour(value: boolean): void {
  try {
    if (value) localStorage.setItem(TOUR_STORAGE_KEY, '1');
    else localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // ignore quota/private mode
  }
}

export const useUIStore = create<UIState>()((set, get) => ({
  currentStep: 'brief',
  briefStep: 0,
  toasts: [],
  exportCenterOpen: false,
  splitViewTransitionId: null,
  hasSeenTour: readHasSeenTour(),
  showTourOnNextRender: false,

  setStep: (step) => set({ currentStep: step }),
  setBriefStep: (n) => set({ briefStep: Math.max(0, Math.min(3, n)) }),

  markTourSeen: () => {
    writeHasSeenTour(true);
    set({ hasSeenTour: true, showTourOnNextRender: false });
  },
  resetTour: () => {
    writeHasSeenTour(false);
    set({ hasSeenTour: false, showTourOnNextRender: false });
  },
  setShowTourOnNextRender: (v: boolean) => set({ showTourOnNextRender: v }),
  consumeShowTour: (): boolean => {
    const v = get().showTourOnNextRender;
    if (v) set({ showTourOnNextRender: false });
    return v;
  },

  addToast: (toast) => {
    const id = uuidv4();
    const newToast: Toast = { id, duration: 4000, ...toast };
    set((s) => ({ toasts: [...s.toasts, newToast] }));
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, newToast.duration);
    }
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  openExportCenter: () => set({ exportCenterOpen: true }),
  closeExportCenter: () => set({ exportCenterOpen: false }),

  openSplitView: (transitionId) => set({ splitViewTransitionId: transitionId }),
  closeSplitView: () => set({ splitViewTransitionId: null }),

  resetAll: () =>
    set({
      currentStep: 'brief',
      briefStep: 0,
      toasts: [],
      exportCenterOpen: false,
      splitViewTransitionId: null,
      showTourOnNextRender: false,
      // hasSeenTour NO se resetea aquí — el botón "Volver al inicio" debe
      // mostrar el CTA del tour de nuevo, pero el flag de "ya vio" se
      // controla explícitamente con resetTour() desde OnboardingResetButton.
    }),
}));
