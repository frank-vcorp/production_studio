/**
 * apiKeysStore — única responsabilidad: validar que el proxy está vivo.
 * NUNCA guarda keys; cliente solo apunta a /api/gemini (relativo).
 * Spec: SPEC-S1-FOUNDATION §1.5 + ARCH-20260703-01 §4.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORAGE_NAME = 'bridge-api-keys-meta';

interface ApiKeysState {
  proxyConnected: boolean;
  proxyUrl: string;             // '/api/gemini' (relativo)
  lastCheckedAt: number | null;
  latencyMs: number | null;
  safetyFlagsEnabled: boolean;
  checkProxy: () => Promise<void>;
  setSafetyFlags: (enabled: boolean) => void;
  /** Versión schema (para futuras migraciones) */
  version: number;
}

const VERSION = 1;

export const useApiKeysStore = create<ApiKeysState>()(
  persist(
    (set) => ({
      proxyConnected: false,
      proxyUrl: '/api/gemini',
      lastCheckedAt: null,
      latencyMs: null,
      safetyFlagsEnabled: true,
      version: VERSION,

      checkProxy: async () => {
        const start = performance.now();
        try {
          // El endpoint /health vive en el worker; caemos al proxy relative path.
          const res = await fetch('/health', { method: 'GET' });
          const latency = Math.round(performance.now() - start);
          set({
            proxyConnected: res.ok,
            lastCheckedAt: Date.now(),
            latencyMs: latency,
          });
        } catch {
          set({
            proxyConnected: false,
            lastCheckedAt: Date.now(),
            latencyMs: null,
          });
        }
      },

      setSafetyFlags: (enabled) => set({ safetyFlagsEnabled: enabled }),
    }),
    {
      name: STORAGE_NAME,
      version: VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        safetyFlagsEnabled: s.safetyFlagsEnabled,
        version: s.version,
      }),
    },
  ),
);
