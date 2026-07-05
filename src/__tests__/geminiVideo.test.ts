import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// jsdom 25 expone URL pero NO URL.createObjectURL/revokeObjectURL (typeof undefined).
// Polyfill mínimo para tests de video (idéntico patrón a jobQueue.test.ts).
if (typeof URL.createObjectURL === 'undefined') {
  let nextId = 0;
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) =>
    `blob:test://${++nextId}#${(b as Blob).size ?? 0}`;
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => undefined;
}

// Mock del cliente HTTP completo. Así evitamos que generateTransitionWithRetry
// llame al fetch real cuando reintenta. El mock por spy sobre generateTransition
// no funciona porque ESM conserva la referencia interna; mockear el cliente es
// la única forma robusta en este proyecto (Vitest 2.1 + Vite 5 ESM).
let impl: ((args: unknown) => Promise<unknown>) | null = null;
let downloadImpl: ((uri: string) => Promise<unknown>) | null = null;

vi.mock('@/services/gemini/client', async () => {
  const actual = await vi.importActual<typeof import('@/services/gemini/client')>(
    '@/services/gemini/client',
  );
  return {
    ...actual,
    geminiClient: {
      generateVideo: vi.fn(async (req: unknown) => {
        // Reconstruimos lo que generateTransition haría internamente:
        // startVideoGeneration valida approval y luego llama a geminiClient.generateVideo.
        // Aquí paramos en este punto y devolvemos el resultado controlado por `impl`.
        if (impl) return impl(req);
        return {
          name: 'operations/op_mock',
          done: true,
          response: {
            generateVideoResponse: {
              videos: [
                { uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media' },
              ],
            },
          },
        };
      }),
      pollOperation: vi.fn(async () => ({
        name: 'operations/op_mock',
        done: true,
        response: {
          generateVideoResponse: {
            videos: [
              { uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media' },
            ],
          },
        },
      })),
      downloadVideo: vi.fn(async (uri: string) => {
        if (downloadImpl) return downloadImpl(uri);
        return new Blob(['mock-video-bytes'], { type: 'video/mp4' });
      }),
    },
  };
});

const { classifyVeoError, generateTransitionWithRetry, RETRY_DELAYS_MS, startVideoGeneration, extractVideoFromOperation } =
  await import('@/services/gemini/video');
import { geminiClient } from '@/services/gemini/client';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';

const transition: KeyframeTransition = {
  id: 'trans_test',
  fromKeyframe: 'kf_a',
  toKeyframe: 'kf_b',
  nodeKey: 'atencion',
  duration: 4,
  prompt: 'test',
  promptFinal: 'test approved',
  cameraSpec: { movement: 'dolly', framing: 'medium', angle: 'eye', speed: 'medium' },
  status: 'approved',
  promptHistory: [],
};

const kfFrom: Keyframe = {
  id: 'kf_a',
  role: 'atencion_in',
  label: 'A',
  description: '',
  source: 'user_upload',
  base64: 'iVBORw0KGgo=',
  mimeType: 'image/png',
  timestamp: 0,
  status: 'approved',
};

const kfTo: Keyframe = {
  id: 'kf_b',
  role: 'atencion_out',
  label: 'B',
  description: '',
  source: 'generated_imagen3',
  base64: 'iVBORw0KGgo=',
  mimeType: 'image/png',
  timestamp: 1,
  status: 'approved',
};

beforeEach(() => {
  impl = null;
  downloadImpl = null;
});

afterEach(() => {
  impl = null;
  downloadImpl = null;
});

describe('gemini/video retry + classify', () => {
  it('classifyVeoError mapea 429 → quota retryable', () => {
    const e = classifyVeoError({ status: 429, message: 'rate limited' });
    expect(e.code).toBe('quota');
    expect(e.retryable).toBe(true);
  });

  it('classifyVeoError mapea 400 con "safety" → safety NO retryable', () => {
    const e = classifyVeoError({ status: 400, message: 'Content blocked by safety filter' });
    expect(e.code).toBe('safety');
    expect(e.retryable).toBe(false);
  });

  it('classifyVeoError mapea 408 → timeout retryable', () => {
    const e = classifyVeoError({ status: 408, message: 'timeout' });
    expect(e.code).toBe('timeout');
    expect(e.retryable).toBe(true);
  });

  it('classifyVeoError mapea 500 → network retryable', () => {
    const e = classifyVeoError({ status: 500, message: 'internal' });
    expect(e.code).toBe('network');
    expect(e.retryable).toBe(true);
  });

  it('classifyVeoError mapea error desconocido → unknown NO retryable', () => {
    const e = classifyVeoError({ status: 418, message: 'I am a teapot' });
    expect(e.code).toBe('unknown');
    expect(e.retryable).toBe(false);
  });

  // ARCH-20260705-02: extracción de mensaje del body JSON estructurado.
  it('classifyVeoError extrae mensaje de body.error.message (no devuelve "[object Object]")', () => {
    const e = classifyVeoError({
      status: 400,
      body: { error: { message: 'data isn\'t supported by this model' } },
    });
    expect(e.message).toBe("data isn't supported by this model");
    expect(e.message).not.toBe('[object Object]');
  });

  it('classifyVeoError extrae mensaje de body string', () => {
    const e = classifyVeoError({ status: 500, body: 'Internal Server Error' });
    expect(e.message).toBe('Internal Server Error');
  });

  it('classifyVeoError extrae mensaje de details.error.message (formato GeminiProxyError)', () => {
    const e = classifyVeoError({
      status: 400,
      details: { error: { message: 'dont_allow for personGeneration is currently not supported' } },
    });
    expect(e.message).toBe('dont_allow for personGeneration is currently not supported');
  });

  it('classifyVeoError ignora message "[object Object]" literal y cae al body', () => {
    const e = classifyVeoError({
      status: 400,
      message: '[object Object]',
      body: { error: { message: 'real error from worker' } },
    });
    expect(e.message).toBe('real error from worker');
  });

  it('classifyVeoError clasifica como safety cuando body.error.message contiene "safety"', () => {
    const e = classifyVeoError({
      status: 400,
      body: { error: { message: 'Content blocked by safety filter' } },
    });
    expect(e.code).toBe('safety');
    expect(e.retryable).toBe(false);
  });

  it('RETRY_DELAYS_MS tiene 5 niveles con backoff exponencial', () => {
    expect(RETRY_DELAYS_MS).toHaveLength(5);
    expect(RETRY_DELAYS_MS[0]).toBe(1000);
    expect(RETRY_DELAYS_MS[4]).toBe(16000);
  });

  it('generateTransitionWithRetry respeta approval gate (throw si status != approved)', async () => {
    const t = { ...transition, status: 'pending' as const };
    await expect(generateTransitionWithRetry(t, kfFrom, kfTo)).rejects.toThrow(/no está aprobada/);
  });

  it('generateTransitionWithRetry onAttempt callback llamado N veces en quota retryable', async () => {
    const onAttempt = vi.fn();
    let calls = 0;
    impl = async () => {
      calls++;
      const err = new Error('rate') as Error & { status: number };
      err.status = 429;
      throw err;
    };
    await expect(
      generateTransitionWithRetry(transition, kfFrom, kfTo, onAttempt),
    ).rejects.toMatchObject({ code: 'quota' });
    expect(calls).toBe(RETRY_DELAYS_MS.length);
    expect(onAttempt).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length);
  }, 60000);

  it('generateTransitionWithRetry lanza inmediato en safety (no reintenta)', async () => {
    let calls = 0;
    impl = async () => {
      calls++;
      const err = new Error('blocked by safety') as Error & { status: number };
      err.status = 400;
      throw err;
    };
    await expect(generateTransitionWithRetry(transition, kfFrom, kfTo)).rejects.toMatchObject({
      code: 'safety',
    });
    expect(calls).toBe(1); // safety → throw inmediato, no 5 intentos
  });
});

// ────────────────────────────────────────────────────────────────────────
// ARCH-20260704-11: shape Gemini (instances[] + parameters) + descarga URI
// ────────────────────────────────────────────────────────────────────────

describe('gemini/video Veo 3.1 body shape + URI download', () => {
  it('startVideoGeneration envía body con instances[0].image.bytesBase64Encoded (NO data, NO input_image en root) — ARCH-20260705-02', async () => {
    const spy = vi.mocked(geminiClient.generateVideo);
    spy.mockClear();
    impl = async () => ({
      name: 'operations/op_xyz',
      done: false,
    });

    const op = await startVideoGeneration({ transition, fromKeyframe: kfFrom, toKeyframe: kfTo });
    expect(op.name).toBe('operations/op_xyz');

    expect(spy).toHaveBeenCalledTimes(1);
    const sent = spy.mock.calls[0][0] as unknown as Record<string, unknown>;

    // NO debe haber campos legacy en root
    expect(sent).not.toHaveProperty('input_image');
    expect(sent).not.toHaveProperty('model');
    expect(sent).not.toHaveProperty('fps');

    // Shape correcto Gemini Veo 3.1
    expect(sent).toHaveProperty('instances');
    expect(sent).toHaveProperty('parameters');
    const instances = sent.instances as Array<{
      prompt: string;
      image?: { bytesBase64Encoded: string; mimeType: string };
    }>;
    expect(instances).toHaveLength(1);
    expect(instances[0].prompt).toBe('test approved');
    expect(instances[0].image).toBeDefined();
    // ARCH-20260705-02: bytesBase64Encoded (no "data").
    expect(instances[0].image?.bytesBase64Encoded).toBe('iVBORw0KGgo=');
    expect(instances[0].image?.mimeType).toBe('image/png');
    expect(instances[0].image).not.toHaveProperty('data');

    const params = sent.parameters as { durationSeconds: number; aspectRatio: string };
    expect(params.durationSeconds).toBe(4);
    expect(params.aspectRatio).toBe('9:16');
    // ARCH-20260705-02: personGeneration removido del body — dont_allow no soportado en Veo 3.1 público.
    expect(params).not.toHaveProperty('personGeneration');
  });

  it('extractVideoFromOperation con respuesta Veo 3.1 → llama downloadVideo con la URI correcta', async () => {
    const fakeUri = 'https://generativelanguage.googleapis.com/v1beta/files/xyz:download?alt=media&key=abc';
    const downloadSpy = vi.mocked(geminiClient.downloadVideo);
    downloadSpy.mockClear();

    const op = {
      name: 'operations/op_done',
      done: true,
      response: {
        generateVideoResponse: {
          videos: [{ uri: fakeUri, mimeType: 'video/mp4' }],
        },
      },
    };

    const { blob, url } = await extractVideoFromOperation(op);

    expect(downloadSpy).toHaveBeenCalledWith(fakeUri);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(url.startsWith('blob:')).toBe(true);
    URL.revokeObjectURL(url);
  });

  it('extractVideoFromOperation lanza error claro en español si no hay videos', async () => {
    const op = {
      name: 'operations/op_empty',
      done: true,
      response: { generateVideoResponse: { videos: [] } },
    };
    await expect(extractVideoFromOperation(op)).rejects.toThrow(/no devolvió ningún video/);
  });

  it('extractVideoFromOperation lanza error si el video no trae URI', async () => {
    const op = {
      name: 'operations/op_no_uri',
      done: true,
      response: { generateVideoResponse: { videos: [{ mimeType: 'video/mp4' }] } },
    };
    await expect(extractVideoFromOperation(op)).rejects.toThrow(/sin URI firmada/);
  });

  it('extractVideoFromOperation lanza 409 si la operación aún no terminó', async () => {
    const op = { name: 'operations/op_pending', done: false };
    await expect(extractVideoFromOperation(op)).rejects.toMatchObject({ status: 409 });
  });

  it('generateTransition end-to-end: mockea start + poll + download con URI firmada', async () => {
    const { generateTransition } = await import('@/services/gemini/video');
    const fakeUri = 'https://generativelanguage.googleapis.com/v1beta/files/end:download?alt=media';
    impl = async () => ({ name: 'operations/op_e2e', done: false });
    // Re-mock pollOperation para este test
    vi.mocked(geminiClient.pollOperation).mockResolvedValueOnce({
      name: 'operations/op_e2e',
      done: true,
      response: { generateVideoResponse: { videos: [{ uri: fakeUri }] } },
    });

    const result = await generateTransition({ transition, fromKeyframe: kfFrom, toKeyframe: kfTo });
    expect(result.operationId).toBe('operations/op_e2e');
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.url.startsWith('blob:')).toBe(true);
    URL.revokeObjectURL(result.url);
  });
});