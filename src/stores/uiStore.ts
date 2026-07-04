/**
 * uiStore — estado efímero de UI (no persistido): step actual, toasts, modals.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { UIState, Toast } from '@/types/project';

export const useUIStore = create<UIState>()((set) => ({
  currentStep: 'brief',
  briefStep: 0,
  toasts: [],
  exportCenterOpen: false,

  setStep: (step) => set({ currentStep: step }),
  setBriefStep: (n) => set({ briefStep: Math.max(0, Math.min(3, n)) }),

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
}));
