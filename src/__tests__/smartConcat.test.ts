/**
 * Tests para smartConcat.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.5 — 4 tests mínimos.
 *
 * Estrategia: mockeamos `ffmpegService.smartConcat` para retornar un Blob
 * sintético y verificamos la metadata (reEncodedSegments/preservedSegments).
 */

import { describe, it, expect, vi } from 'vitest';
import { smartConcat, estimateSmartConcatEta } from '@/services/smartConcat';
import type { SubtitleStyle } from '@/types/project';

vi.mock('@/services/ffmpeg', () => ({
  ffmpegService: {
    smartConcat: vi.fn(async ({ blobs }: { blobs: { role: string; blob: Blob }[] }) => {
      // Devuelve un Blob "sintético" del tamaño esperado
      const total = blobs.reduce((acc, b) => acc + b.blob.size, 0);
      return new Blob([new Uint8Array(Math.min(64, total || 1))], { type: 'video/mp4' });
    }),
  },
}));

function makeBlob(size: number, type = 'video/mp4'): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

describe('smartConcat', () => {
  it('4 preserved + 2 new → reEncodedSegments solo los new roles', async () => {
    const preserved = [
      { role: 'bumper', blob: makeBlob(1000) },
      { role: 'atencion', blob: makeBlob(1000) },
      { role: 'interes', blob: makeBlob(1000) },
      { role: 'deseo', blob: makeBlob(1000) },
    ];
    const newClips = [
      { role: 'accion', blob: makeBlob(500) },
      { role: 'cta', blob: makeBlob(500) },
    ];
    const result = await smartConcat({
      preservedClips: preserved,
      newClips,
      timelineOrder: ['bumper', 'atencion', 'interes', 'deseo', 'accion', 'cta'],
    });
    expect(result.reEncodedSegments.sort()).toEqual(['accion', 'cta']);
    expect(result.preservedSegments.sort()).toEqual(['atencion', 'bumper', 'deseo', 'interes']);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('timelineOrder vacío → lanza error', async () => {
    await expect(
      smartConcat({
        preservedClips: [],
        newClips: [],
        timelineOrder: [],
      }),
    ).rejects.toThrow();
  });

  it('Si role no existe → se omite silenciosamente', async () => {
    const preserved = [{ role: 'bumper', blob: makeBlob(1000) }];
    const result = await smartConcat({
      preservedClips: preserved,
      newClips: [],
      timelineOrder: ['bumper', 'no-existe'],
    });
    expect(result.preservedSegments).toEqual(['bumper']);
  });

  it('ETA estimado crece con newClipCount', () => {
    expect(estimateSmartConcatEta(0)).toBeGreaterThanOrEqual(6);
    expect(estimateSmartConcatEta(2)).toBeGreaterThan(estimateSmartConcatEta(0));
    expect(estimateSmartConcatEta(5)).toBeLessThanOrEqual(30);
  });

  it('Acepta burnedSubs + musicBed en input (sin validar contenido)', async () => {
    const style: SubtitleStyle = {
      fontFamily: 'Inter',
      fontSize: 24,
      color: '#FFFFFF',
      outline: 2,
      shadow: 1,
      marginV: 24,
      bold: true,
    };
    const result = await smartConcat({
      preservedClips: [{ role: 'bumper', blob: makeBlob(100) }],
      newClips: [{ role: 'cta', blob: makeBlob(100) }],
      timelineOrder: ['bumper', 'cta'],
      burnedSubs: { vttContent: 'WEBVTT', style },
      musicBed: makeBlob(50, 'audio/wav'),
    });
    expect(result.reEncodedSegments).toEqual(['cta']);
  });

  // H2-fix (IMPL-20260704-01): tests adicionales para subs burn + audio mix
  it('H2 Test A: appliedFilters.subs=true cuando burnedSubs viene (sin music)', async () => {
    const style: SubtitleStyle = {
      fontFamily: 'Inter',
      fontSize: 20,
      color: '#FFFF00',
      outline: 1,
      shadow: 0,
      marginV: 16,
      bold: false,
    };
    const result = await smartConcat({
      preservedClips: [{ role: 'bumper', blob: makeBlob(100) }],
      newClips: [{ role: 'cta', blob: makeBlob(100) }],
      timelineOrder: ['bumper', 'cta'],
      burnedSubs: { vttContent: 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHola mundo', style },
    });
    expect(result.appliedFilters?.subs).toBe(true);
    expect(result.appliedFilters?.music).toBe(false);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('H2 Test B: appliedFilters.music=true cuando musicBed viene (sin subs)', async () => {
    const result = await smartConcat({
      preservedClips: [{ role: 'bumper', blob: makeBlob(100) }],
      newClips: [{ role: 'cta', blob: makeBlob(100) }],
      timelineOrder: ['bumper', 'cta'],
      musicBed: makeBlob(64, 'audio/wav'),
    });
    expect(result.appliedFilters?.subs).toBe(false);
    expect(result.appliedFilters?.music).toBe(true);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('H2 Test C: appliedFilters ambos=true cuando burnedSubs + musicBed vienen', async () => {
    const style: SubtitleStyle = {
      fontFamily: 'Inter',
      fontSize: 24,
      color: '#FFFFFF',
      outline: 2,
      shadow: 1,
      marginV: 24,
      bold: true,
    };
    const result = await smartConcat({
      preservedClips: [{ role: 'bumper', blob: makeBlob(100) }],
      newClips: [{ role: 'cta', blob: makeBlob(100) }],
      timelineOrder: ['bumper', 'cta'],
      burnedSubs: { vttContent: 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest', style },
      musicBed: makeBlob(50, 'audio/wav'),
    });
    expect(result.appliedFilters?.subs).toBe(true);
    expect(result.appliedFilters?.music).toBe(true);
  });

  it('H2 Test D: appliedFilters ambos=false cuando NO vienen ni subs ni music', async () => {
    const result = await smartConcat({
      preservedClips: [{ role: 'bumper', blob: makeBlob(100) }],
      newClips: [{ role: 'cta', blob: makeBlob(100) }],
      timelineOrder: ['bumper', 'cta'],
    });
    expect(result.appliedFilters?.subs).toBe(false);
    expect(result.appliedFilters?.music).toBe(false);
  });
});