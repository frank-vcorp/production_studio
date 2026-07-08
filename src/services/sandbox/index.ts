/**
 * sandbox — Re-exports de los mocks deterministas de Gemini.
 * Spec: ARCH-20260705-04 + SPEC-20260705-04_sandbox_mock_gemini.md
 *
 * Mantén este index centralizado: cualquier consumidor nuevo (services/gemini/*)
 * debe importar desde `@/services/sandbox` para que el bundle tree-shaking siga
 * funcionando cuando VITE_USE_SANDBOX=false (los mocks no entran al bundle).
 */
export { mockAnalyzeImageForVision } from './mockVision';
export {
  mockStartVideoGeneration,
  mockPollVideoOperation,
  mockExtractVideoFromOperation,
} from './mockVideo';
export { mockGenerateImage } from './mockImageGen';

export type { MockVideoOpts } from './mockVideo';