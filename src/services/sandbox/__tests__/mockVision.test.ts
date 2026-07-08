/**
 * Tests para mockVision (sandbox determinista).
 * Spec: ARCH-20260705-04.
 */
import { describe, it, expect } from 'vitest';
import { mockAnalyzeImageForVision } from '@/services/sandbox/mockVision';

// Polyfill OffscreenCanvas para jsdom (necesario para hash + canvas).
if (typeof OffscreenCanvas === 'undefined') {
  class StubOffscreenCanvas {
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
    getContext(): null {
      return null;
    }
    convertToBlob(): Promise<Blob> {
      return Promise.resolve(new Blob([new Uint8Array([0])], { type: 'image/png' }));
    }
  }
  (globalThis as unknown as { OffscreenCanvas: typeof OffscreenCanvas }).OffscreenCanvas =
    StubOffscreenCanvas as unknown as typeof OffscreenCanvas;
}

describe('sandbox/mockVision', () => {
  it('devuelve VisualAnalysis con model sandbox-vision-v1', async () => {
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const out = await mockAnalyzeImageForVision(blob);
    expect(out.model).toBe('sandbox-vision-v1');
    expect(out.subject).toMatch(/SANDBOX/);
    expect(out.confidence).toBeGreaterThan(0);
  });

  it('mismo blob → mismo hash en subject (determinista)', async () => {
    const data = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const blob1 = new Blob([data], { type: 'image/png' });
    const blob2 = new Blob([data], { type: 'image/png' });
    const a = await mockAnalyzeImageForVision(blob1);
    const b = await mockAnalyzeImageForVision(blob2);
    const hashA = a.subject.match(/h:([a-f0-9]+)/)?.[1];
    const hashB = b.subject.match(/h:([a-f0-9]+)/)?.[1];
    expect(hashA).toBeDefined();
    expect(hashA).toBe(hashB);
  });

  it('campos obligatorios del VisualAnalysis presentes', async () => {
    const out = await mockAnalyzeImageForVision(new Blob([new Uint8Array([1])], { type: 'image/png' }));
    expect(out.subject).toBeTruthy();
    expect(out.environment).toBeTruthy();
    expect(out.lighting).toBeTruthy();
    expect(out.composition).toBeTruthy();
    expect(Array.isArray(out.colorPalette)).toBe(true);
    expect(out.colorPalette.length).toBeGreaterThan(0);
    expect(out.depthOfField).toMatch(/shallow|medium|deep/);
    expect(out.analyzedAt).toBeGreaterThan(0);
  });
});