/**
 * Tests para el toggle IS_SANDBOX en los servicios de Gemini.
 * Spec: ARCH-20260705-04.
 *
 * Verifica que cuando IS_SANDBOX=true, los servicios NO llaman al cliente
 * real de Gemini (geminiClient.analyzeImage / .generateVideo / .generateImage).
 *
 * Técnica: usamos vi.mock para sustituir el módulo `@/utils/sandbox` con un
 * valor controlado de IS_SANDBOX antes de importar los servicios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helper: mock del módulo sandbox + spy del cliente Gemini.
// Cada test llama a esta función con el valor deseado de IS_SANDBOX.

async function loadServicesWithSandbox(sandbox: boolean) {
  vi.resetModules();
  vi.doMock('@/utils/sandbox', () => ({
    IS_SANDBOX: sandbox,
    SANDBOX_DISCLAIMER: sandbox ? 'mocked sandbox active' : '',
    SANDBOX_TAG: 'sandbox',
  }));
  // Mockear geminiClient para detectar llamadas
  const calls = { analyzeImage: 0, generateVideo: 0, generateImage: 0 };
  vi.doMock('@/services/gemini/client', async () => {
    const actual = await vi.importActual<typeof import('@/services/gemini/client')>(
      '@/services/gemini/client',
    );
    // VisualAnalysis válido completo (todos los campos obligatorios).
    const validVisionJson = JSON.stringify({
      subject: 'real subject from gemini',
      environment: 'real environment',
      lighting: 'real lighting',
      composition: 'real composition',
      colorPalette: ['#000000', '#111111', '#222222', '#333333'],
      textures: ['textura real'],
      cameraPosition: 'real camera position',
      depthOfField: 'medium',
      dominantShapes: ['rectangle'],
      technicalNotes: 'real technical notes',
      confidence: 0.9,
    });
    return {
      ...actual,
      geminiClient: {
        ...actual.geminiClient,
        analyzeImage: vi.fn(async () => {
          calls.analyzeImage += 1;
          return {
            candidates: [
              { content: { parts: [{ text: validVisionJson }] } },
            ],
          };
        }),
        generateVideo: vi.fn(async () => {
          calls.generateVideo += 1;
          return { name: 'real-op', done: false };
        }),
        generateImage: vi.fn(async () => {
          calls.generateImage += 1;
          return { predictions: [{ bytesBase64Encoded: 'aGVsbG8=', mimeType: 'image/png' }] };
        }),
        pollOperation: vi.fn(async (n: string) => ({
          name: n,
          done: true,
          response: { generateVideoResponse: { videos: [{ uri: 'https://example.com/x' }] } },
        })),
        downloadVideo: vi.fn(async () => new Blob(['real'], { type: 'video/mp4' })),
      },
    };
  });

  return {
    calls,
    imageAnalysis: await import('@/services/gemini/imageAnalysis'),
    video: await import('@/services/gemini/video'),
    keyframeGen: await import('@/services/gemini/keyframeGenerator'),
  };
}

beforeEach(() => {
  vi.doUnmock('@/utils/sandbox');
  vi.doUnmock('@/services/gemini/client');
});

describe('sandbox toggle en servicios Gemini', () => {
  it('con IS_SANDBOX=true, analyzeImageForVision NO llama geminiClient.analyzeImage', async () => {
    const { calls, imageAnalysis } = await loadServicesWithSandbox(true);
    const out = await imageAnalysis.analyzeImageForVision(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    expect(calls.analyzeImage).toBe(0);
    expect(out.model).toBe('sandbox-vision-v1');
  });

  it('con IS_SANDBOX=false, analyzeImageForVision SÍ llama geminiClient.analyzeImage', async () => {
    const { calls, imageAnalysis } = await loadServicesWithSandbox(false);
    const out = await imageAnalysis.analyzeImageForVision(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    expect(calls.analyzeImage).toBeGreaterThan(0);
    expect(out.model).toBe('gemini-2.5-flash');
  });

  it('con IS_SANDBOX=true, generateKeyframeOut NO llama geminiClient.generateImage', async () => {
    const { calls, keyframeGen } = await loadServicesWithSandbox(true);
    const kfIn = {
      id: 'kf_in',
      role: 'atencion_in' as const,
      label: 'in',
      description: '',
      source: 'user_upload' as const,
      base64: 'aGVsbG8=',
      mimeType: 'image/png',
      timestamp: 0,
      status: 'uploaded' as const,
    };
    const out = await keyframeGen.generateKeyframeOut(
      kfIn,
      'intent',
      { movement: 'dolly', framing: 'medium', angle: 'eye', speed: 'medium' },
      // @ts-expect-error - masterBrief mínimo para test
      { business: { name: 'test' }, services: [] },
      null,
    );
    expect(calls.generateImage).toBe(0);
    expect(out.blob.size).toBeGreaterThan(0);
    expect(out.mimeType).toBe('image/png');
  });
});