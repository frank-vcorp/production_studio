import { describe, it, expect, vi } from 'vitest';
import { isRecoverableError, generateFallbackVideo } from '@/services/fallbackStrategy';
import type { VeoError } from '@/types/jobs';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';

function mkVeoErr(code: VeoError['code']): VeoError {
  return Object.assign(new Error(`veo ${code}`), { code, retryable: false });
}

const transition: KeyframeTransition = {
  id: 't1',
  fromKeyframe: 'kf_a',
  toKeyframe: 'kf_b',
  nodeKey: 'atencion',
  duration: 4,
  prompt: 'p',
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

describe('fallbackStrategy', () => {
  it('isRecoverableError: safety, quota, timeout, unknown son recuperables', () => {
    expect(isRecoverableError(mkVeoErr('safety'))).toBe(true);
    expect(isRecoverableError(mkVeoErr('quota'))).toBe(true);
    expect(isRecoverableError(mkVeoErr('timeout'))).toBe(true);
    expect(isRecoverableError(mkVeoErr('unknown'))).toBe(true);
  });

  it('isRecoverableError: network NO es recuperable vía fallback (ya retryable)', () => {
    // network se reintenta en retry; si agota, el caller decide. Aquí mantenemos
    // contrato: solo safety/quota/timeout/unknown → fallback.
    expect(isRecoverableError(mkVeoErr('network'))).toBe(false);
  });

  it('generateFallbackVideo Strategy 1: imagen estática OK', async () => {
    // ffmpegService.staticVideoFromImage mockeado para devolver Blob fake.
    const ffmpegModule = await import('@/services/ffmpeg');
    vi.spyOn(ffmpegModule.ffmpegService, 'staticVideoFromImage').mockResolvedValue(
      new Blob(['fake-video'], { type: 'video/mp4' }),
    );

    const result = await generateFallbackVideo({
      transition,
      keyframeFrom: kfFrom,
      keyframeTo: null,
      reason: 'safety',
      brief: null,
    });
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.strategy).toBe('imagen3_blur_zoom');
    expect(result.reason).toBe('safety');
    expect(result.generationLog.some((l) => l.includes('Fallback activado'))).toBe(true);
  });

  it('generateFallbackVideo Strategy 2: si Strategy 1 falla, intenta plain color', async () => {
    const ffmpegModule = await import('@/services/ffmpeg');
    let calls = 0;
    vi.spyOn(ffmpegModule.ffmpegService, 'staticVideoFromImage').mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        throw new Error('strategy 1 fail');
      }
      return new Blob(['fake-plain'], { type: 'video/mp4' });
    });

    const result = await generateFallbackVideo({
      transition,
      keyframeFrom: kfFrom,
      keyframeTo: null,
      reason: 'quota',
      brief: null,
    });
    expect(result.strategy).toBe('plain_color_with_text');
    expect(result.reason).toBe('quota');
    expect(calls).toBe(2);
  });

  it('generateFallbackVideo lanza error si ambas strategies fallan', async () => {
    const ffmpegModule = await import('@/services/ffmpeg');
    vi.spyOn(ffmpegModule.ffmpegService, 'staticVideoFromImage').mockRejectedValue(
      new Error('ffmpeg fail'),
    );

    await expect(
      generateFallbackVideo({
        transition,
        keyframeFrom: kfFrom,
        keyframeTo: null,
        reason: 'safety',
        brief: null,
      }),
    ).rejects.toThrow(/All fallback strategies failed/);
  });
});