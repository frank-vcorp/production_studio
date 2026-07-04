/**
 * FFmpegService — cliente Promise-based del WebWorker.
 * Maneja pending por requestId y reusa la misma instancia.
 * Spec: SPEC-S1-FOUNDATION §1.14 + ARCH-20260703-03.
 */

import type { SubtitleStyle } from '@/types/project';

type WorkerResult = Blob | void;
type ProgressHandler = (p: { progress: number; time: number }) => void;

export interface ConcatOpts {
  clips: Blob[];
  outputName?: string;
}

export interface SmartConcatOpts {
  blobs: { role: string; blob: Blob }[];
  timelineOrder: string[];
  outputName?: string;
  /** H2-fix: subs quemados opcionales (filter chain VTT→ASS). */
  burnedSubs?: { vttContent: string; style: import('@/types/project').SubtitleStyle };
  /** H2-fix: music bed opcional (mix con ducking + fade in/out). */
  musicBed?: Blob;
}

export interface BurnSubsOpts {
  video: Blob;
  vtt: string;
  style: SubtitleStyle;
  outputName?: string;
}

export interface MixAudioOpts {
  video: Blob;
  voiceover: Blob;
  music?: Blob;
  ducking?: boolean;
  outputName?: string;
}

class FFmpegServiceImpl {
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: (v: WorkerResult) => void; reject: (e: Error) => void }>();
  private initPromise: Promise<void> | null = null;
  public onProgress: ProgressHandler | null = null;

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL('../workers/ffmpeg.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent) => this.handle(e);
    this.worker.onerror = (e: ErrorEvent) => {
      console.error('[ffmpeg] worker error', e);
    };
    return this.worker;
  }

  private handle(event: MessageEvent): void {
    const { type, requestId, payload } = event.data ?? {};
    if (type === 'PROGRESS' || type === 'LOG') {
      if (type === 'PROGRESS' && this.onProgress) this.onProgress(payload);
      return;
    }
    const slot = this.pending.get(requestId);
    if (!slot) return;
    this.pending.delete(requestId);
    if (type === 'RESULT' || type === 'READY') {
      slot.resolve(payload as WorkerResult);
    } else if (type === 'ERROR') {
      slot.reject(new Error(payload ?? 'FFmpeg worker error'));
    }
  }

  private send<T = WorkerResult>(type: string, payload: unknown, outputName?: string): Promise<T> {
    const worker = this.getWorker();
    const requestId = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve: (v) => resolve(v as T), reject });
      worker.postMessage({ type, payload, requestId, ...(outputName ? { outputName } : {}) });
    });
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.send<void>('INIT', {}).then(() => undefined);
    return this.initPromise;
  }

  async concatClips(opts: ConcatOpts): Promise<Blob> {
    await this.init();
    const blobs = opts.clips.map((b) => ({ blob: b }));
    return this.send<Blob>('CONCAT', blobs, opts.outputName ?? 'concat.mp4');
  }

  async burnSubtitles(opts: BurnSubsOpts): Promise<Blob> {
    await this.init();
    return this.send<Blob>(
      'BURN_SUBS',
      {
        videoBlob: opts.video,
        vttContent: opts.vtt,
        style: opts.style,
      },
      opts.outputName ?? 'subbed.mp4',
    );
  }

  async mixAudio(opts: MixAudioOpts): Promise<Blob> {
    await this.init();
    return this.send<Blob>(
      'MIX_AUDIO',
      {
        videoBlob: opts.video,
        voBlob: opts.voiceover,
        musicBlob: opts.music ?? null,
        ducking: opts.ducking,
      },
      opts.outputName ?? 'mixed.mp4',
    );
  }

  async smartConcat(opts: SmartConcatOpts): Promise<Blob> {
    await this.init();
    // H2-fix: separar burnedSubs (objeto) y musicBed (Blob→ArrayBuffer) para
    // que crucen structured-clone del postMessage al WebWorker.
    const payload: Record<string, unknown> = {
      blobs: opts.blobs,
      timelineOrder: opts.timelineOrder,
    };
    if (opts.burnedSubs) {
      payload.burnedSubs = opts.burnedSubs;
    }
    if (opts.musicBed) {
      payload.musicBed = await opts.musicBed.arrayBuffer();
    }
    return this.send<Blob>('SMART_CONCAT', payload, opts.outputName ?? 'master.mp4');
  }

  /** Convierte una imagen estática en un MP4 de duración fija. */
  async staticVideoFromImage(image: Blob, durationSec: number): Promise<Blob> {
    await this.init();
    return new Promise<Blob>((resolve, reject) => {
      const worker = this.getWorker();
      const requestId = crypto.randomUUID();
      const onMsg = (e: MessageEvent): void => {
        const { type, requestId: rid, payload } = e.data ?? {};
        if (rid !== requestId) return;
        worker.removeEventListener('message', onMsg);
        if (type === 'RESULT') resolve(payload as Blob);
        else if (type === 'ERROR') reject(new Error(payload ?? 'unknown'));
      };
      worker.addEventListener('message', onMsg);
      worker.postMessage({
        type: 'STATIC_FROM_IMAGE',
        requestId,
        payload: { image, durationSec },
        outputName: `static-${requestId}.mp4`,
      });
    });
  }

  terminate(): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: 'TERMINATE' });
    this.worker = null;
    this.initPromise = null;
    this.pending.clear();
  }
}

export const ffmpegService = new FFmpegServiceImpl();
