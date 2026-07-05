import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock del cliente HTTP completo. Así evitamos que generateTransitionWithRetry
// llame al fetch real cuando reintenta. El mock por spy sobre generateTransition
// no funciona porque ESM conserva la referencia interna; mockear el cliente es
// la única forma robusta en este proyecto (Vitest 2.1 + Vite 5 ESM).
let impl: ((args: unknown) => Promise<unknown>) | null = null;

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
            videos: [
              {
                inlineData: { mimeType: 'video/mp4', data: 'aGVsbG8=' },
              },
            ],
          },
        };
      }),
      pollOperation: vi.fn(async () => ({
        name: 'operations/op_mock',
        done: true,
        response: {
          videos: [
            {
              inlineData: { mimeType: 'video/mp4', data: 'aGVsbG8=' },
            },
          ],
        },
      })),
    },
  };
});

const { classifyVeoError, generateTransitionWithRetry, RETRY_DELAYS_MS } =
  await import('@/services/gemini/video');
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
});

afterEach(() => {
  impl = null;
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