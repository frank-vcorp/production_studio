/**
 * Tests para exportBatch (sin levantar Worker real — usamos un fake).
 *
 * El fake enriquece respuestas simuladas del Worker (READY, PROGRESS, RESULT)
 * para validar:
 *  - generación paralela de N ratios
 *  - abortSignal cancela
 *  - ZIP final contiene los vídeos + subs + VO + manifest
 */

import { describe, it, expect, afterEach } from 'vitest';

// Mock del Worker vía factory — devolvemos un FakeWorker que simula mensajes.
class FakeWorker extends EventTarget {
  url: string | URL;
  options: WorkerOptions;
  posted: Array<{ type: string; payload: unknown; requestId: string; outputName?: string }> = [];
  terminated = false;

  constructor(url: string | URL, options: WorkerOptions) {
    super();
    this.url = url;
    this.options = options;
  }

  postMessage(msg: { type: string; payload?: unknown; requestId: string; outputName?: string }): void {
    this.posted.push({
      type: msg.type,
      payload: msg.payload,
      requestId: msg.requestId,
      outputName: msg.outputName,
    });
    // Simula respuesta asíncrona del worker
    queueMicrotask(() => {
      if (msg.type === 'INIT') {
        this.dispatchEvent(
          new MessageEvent('message', { data: { type: 'READY', requestId: msg.requestId } }),
        );
      } else if (msg.type === 'EXPORT_RATIO') {
        this.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'RESULT',
              requestId: msg.requestId,
              payload: new Blob(['fake-' + msg.outputName], { type: 'video/mp4' }),
            },
          }),
        );
      }
    });
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(type: string, listener: EventListener): void {
    super.addEventListener(type, listener);
  }
  removeEventListener(type: string, listener: EventListener): void {
    super.removeEventListener(type, listener);
  }
}

import { batchEncodePack, vttToSrt } from '@/services/exportBatch';
import type { AspectRatio, ExportPackOptions } from '@/types/export';

const OPTIONS: ExportPackOptions = {
  enabledRatios: ['9:16', '1:1'] as AspectRatio[],
  includeSafeZones: false,
  includeBurnedSubs: false,
  includeWatermark: false,
  watermarkOpacity: 0.08,
  watermarkPosition: 'bottom-right',
  includeManifest: true,
  includeVOAudio: true,
  includeSubtitlesSRT: true,
};

function installFakeWorker(): FakeWorker[] {
  const fakeWorkers: FakeWorker[] = [];
  const Fake = function (this: FakeWorker, url: string | URL, options: WorkerOptions) {
    const w = new FakeWorker(url, options);
    fakeWorkers.push(w);
    return w;
  };
  // Override Worker global — comportamiento esperado en jsdom donde Worker no existe.
  globalThis.Worker = Fake as unknown as typeof Worker;
  return fakeWorkers;
}

describe('exportBatch', () => {
  afterEach(() => {
    // restore: en jsdom Worker no está definido originalmente → no-op
    // @ts-expect-error restore: WebWorker type puede no estar en tsconfig
    if (globalThis.Worker) delete globalThis.Worker;
  });

  it('genera 2 vídeos en paralelo (cada uno lanza su propio Worker)', async () => {
    const fakeWorkers = installFakeWorker();
    const master = new Blob(['master-content'], { type: 'video/mp4' });
    const result = await batchEncodePack({
      masterBlob: master,
      masterDurationSec: 30,
      options: OPTIONS,
      brandKit: null,
      manifestJson: { blob: new Blob(['{}']), filename: 'manifest.json' },
      voAudio: { blob: new Blob(['vo']), filename: 'vo.wav' },
      subtitleVtt: 'WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nhola',
      onProgress: () => {},
    });

    expect(result.videos).toHaveLength(2);
    expect(result.videos.map((v) => v.aspectRatio)).toEqual(['9:16', '1:1']);
    expect(result.zip).toBeDefined();
    expect(result.zip!.blob.size).toBeGreaterThan(0);
    expect(result.zip!.filename).toMatch(/^bridge_pack_/);
    expect(result.zip!.filename).toMatch(/\.zip$/);
    // 2 Workers spawneados (uno por ratio, paralelismo real)
    expect(fakeWorkers.length).toBeGreaterThanOrEqual(2);
    expect(fakeWorkers.every((w) => w.terminated)).toBe(true); // cleanup
  });

  it('abortSignal saltado no genera vídeos', async () => {
    const fakeWorkers = installFakeWorker();
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await batchEncodePack({
      masterBlob: new Blob(['master'], { type: 'video/mp4' }),
      masterDurationSec: 30,
      options: OPTIONS,
      brandKit: null,
      abortSignal: ctrl.signal,
    });
    // abort antes de iniciar → ningún worker creado
    expect(fakeWorkers.length).toBe(0);
    expect(result.videos).toHaveLength(0);
  });

  it('ZIP contiene subs + VO + manifest cuando includeX=true', async () => {
    installFakeWorker();
    const JSZip = (await import('jszip')).default;
    const master = new Blob(['m'], { type: 'video/mp4' });
    const result = await batchEncodePack({
      masterBlob: master,
      masterDurationSec: 30,
      options: OPTIONS,
      brandKit: null,
      subtitleVtt:
        'WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nhola\n\n2\n00:00:01.000 --> 00:00:02.000\nmundo',
      voAudio: { blob: new Blob(['vo']), filename: 'vo.wav' },
      manifestJson: { blob: new Blob(['{"hello":"world"}']), filename: 'manifest.json' },
    });
    const zip = await JSZip.loadAsync(result.zip!.blob);
    const names = Object.keys(zip.files);
    expect(names).toContain('subs.srt');
    expect(names).toContain('vo.wav');
    expect(names).toContain('manifest.json');
    expect(names).toContain('README.txt');
    const srt = await zip.file('subs.srt')!.async('string');
    expect(srt).toContain('00:00:00,000 --> 00:00:01,000');
    expect(srt).toContain('hola');
    expect(srt).toMatch(/^1\n/m);
  });

  it('vttToSrt convierte puntos decimales a comas y numera', () => {
    const srt = vttToSrt(
      'WEBVTT\n\n00:00:01.500 --> 00:00:03.200\nhola\n\n00:00:04.000 --> 00:00:05.000\nmundo',
    );
    expect(srt).toContain('00:00:01,500 --> 00:00:03,200');
    expect(srt).toContain('00:00:04,000 --> 00:00:05,000');
    expect(srt).toMatch(/^1\n/m);
    expect(srt).toMatch(/^2\n/m);
  });
});
