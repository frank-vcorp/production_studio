/**
 * sandbox — Utilidades para activar/detectar el modo sandbox.
 * Spec: ARCH-20260705-04 + SPEC-20260705-04_sandbox_mock_gemini.md
 *
 * El sandbox permite validar flujos end-to-end (Vision / Imagen 3 / Veo 3.1)
 * SIN gastar créditos de Gemini API. Se activa con la env var
 * `VITE_USE_SANDBOX=true` (default en `.env.development`).
 *
 * El toggle es **estático a nivel de módulo** (no dinámico): se evalúa una sola
 * vez al cargar el bundle. Cambiar la variable requiere reiniciar `vite`.
 */
export const IS_SANDBOX: boolean = import.meta.env.VITE_USE_SANDBOX === 'true';

export const SANDBOX_DISCLAIMER: string = IS_SANDBOX
  ? '🧪 Modo SANDBOX activo. Ninguna llamada a Gemini API se está realizando. Para datos reales configurá VITE_USE_SANDBOX=false.'
  : '';

/** ID estable por sesión para etiquetar operaciones del sandbox. */
export const SANDBOX_TAG = 'sandbox';