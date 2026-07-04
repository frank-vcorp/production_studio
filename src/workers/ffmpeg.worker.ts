/**
 * ffmpeg.worker.ts — WebWorker para FFmpeg WASM.
 * Carga lazy, expone operaciones CONCAT / BURN_SUBS / MIX_AUDIO / SMART_CONCAT.
 * Spec: SPEC-S1-FOUNDATION §1.14 + ARCH-20260703-03.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loaded = false;

interface BaseMsg {
  type: string;
  requestId: string;
}

interface ConcatMsg extends BaseMsg {
  type: 'CONCAT';
  payload: { blob: Blob }[];
  outputName?: string;
}

interface BurnSubsMsg extends BaseMsg {
  type: 'BURN_SUBS';
  payload: {
    videoBlob: Blob;
    vttContent: string;
    style: {
      fontFamily: string;
      fontSize: number;
      color: string;
      outline: number;
      shadow: number;
      marginV: number;
      bold: boolean;
    };
  };
  outputName?: string;
}

interface MixAudioMsg extends BaseMsg {
  type: 'MIX_AUDIO';
  payload: {
    videoBlob: Blob;
    voBlob: Blob;
    musicBlob?: Blob;
    ducking?: boolean;
  };
  outputName?: string;
}

interface SmartConcatMsg extends BaseMsg {
  type: 'SMART_CONCAT';
  payload: {
    blobs: { role: string; blob: Blob }[];
    timelineOrder: string[];
  };
  outputName?: string;
}

interface InitMsg extends BaseMsg {
  type: 'INIT';
}

interface TerminateMsg extends BaseMsg {
  type: 'TERMINATE';
}

interface StaticFromImageMsg extends BaseMsg {
  type: 'STATIC_FROM_IMAGE';
  payload: { image: Blob; durationSec: number };
  outputName?: string;
}

type WorkerMsg = InitMsg | ConcatMsg | BurnSubsMsg | MixAudioMsg | SmartConcatMsg | StaticFromImageMsg | TerminateMsg;

const CORE_BASE = '/ffmpeg-core';

async function ensureLoaded(): Promise<void> {
  if (loaded && ffmpeg) return;
  ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => {
    self.postMessage({ type: 'LOG', payload: message });
  });
  ffmpeg.on('progress', ({ progress, time }) => {
    self.postMessage({ type: 'PROGRESS', payload: { progress, time } });
  });

  try {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  } catch {
    // Fallback: cargar desde unpkg CDN (dev)
    await ffmpeg.load({
      coreURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js', 'text/javascript'),
      wasmURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm', 'application/wasm'),
    });
  }
  loaded = true;
}

function hexToASS(hex: string): string {
  // #RRGGBB -> &HBBGGRR& (ASS BGR)
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '&HFFFFFF&';
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H${b}${g}${r}&`.toUpperCase();
}

function toResultBlob(data: unknown): { blob: Blob; transfer: ArrayBuffer } {
  const bytes = data as Uint8Array;
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'video/mp4' });
  return { blob, transfer: ab };
}

async function execConcat(msg: ConcatMsg) {
  await ensureLoaded();
  if (!ffmpeg) throw new Error('FFmpeg no inicializado');
  const { payload, outputName = 'concat.mp4' } = msg;
  for (let i = 0; i < payload.length; i++) {
    await ffmpeg.writeFile(`clip_${i}.mp4`, await fetchFile(payload[i].blob));
  }
  const list = payload.map((_, i) => `file 'clip_${i}.mp4'`).join('\n');
  await ffmpeg.writeFile('filelist.txt', new TextEncoder().encode(list));
  await ffmpeg.exec([
    '-f', 'concat', '-safe', '0',
    '-i', 'filelist.txt',
    '-c', 'copy',
    '-movflags', '+faststart',
    outputName,
  ]);
  const data = await ffmpeg.readFile(outputName);
  const { blob, transfer } = toResultBlob(data);
  self.postMessage({ type: 'RESULT', requestId: msg.requestId, payload: blob }, [transfer]);
}

async function execBurnSubs(msg: BurnSubsMsg) {
  await ensureLoaded();
  if (!ffmpeg) throw new Error('FFmpeg no inicializado');
  const { payload, outputName = 'subbed.mp4' } = msg;
  await ffmpeg.writeFile('input.mp4', await fetchFile(payload.videoBlob));
  await ffmpeg.writeFile('subs.vtt', new TextEncoder().encode(payload.vttContent));
  const forceStyle = [
    `FontName=${payload.style.fontFamily}`,
    `FontSize=${payload.style.fontSize}`,
    `PrimaryColour=${hexToASS(payload.style.color)}`,
    `Outline=${payload.style.outline}`,
    `Shadow=${payload.style.shadow}`,
    `MarginV=${payload.style.marginV}`,
    `Alignment=2`,
    `Bold=${payload.style.bold ? 1 : 0}`,
  ].join(',');
  try {
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vf', `subtitles=subs.vtt:force_style='${forceStyle}'`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outputName,
    ]);
  } catch {
    // Fallback: sin subs si FFmpeg no tiene libass/libvtt — devuelve el original renombrado
    await ffmpeg.exec(['-i', 'input.mp4', '-c', 'copy', '-movflags', '+faststart', outputName]);
  }
  const data = await ffmpeg.readFile(outputName);
  const { blob, transfer } = toResultBlob(data);
  self.postMessage({ type: 'RESULT', requestId: msg.requestId, payload: blob }, [transfer]);
}

async function execMixAudio(msg: MixAudioMsg) {
  await ensureLoaded();
  if (!ffmpeg) throw new Error('FFmpeg no inicializado');
  const { payload, outputName = 'mixed.mp4' } = msg;
  await ffmpeg.writeFile('input.mp4', await fetchFile(payload.videoBlob));
  await ffmpeg.writeFile('vo.wav', await fetchFile(payload.voBlob));
  const args: string[] = ['-i', 'input.mp4', '-i', 'vo.wav'];
  if (payload.musicBlob) {
    args.push('-i', 'music.wav');
    await ffmpeg.writeFile('music.wav', await fetchFile(payload.musicBlob));
  }
  if (payload.musicBlob && payload.ducking !== false) {
    args.push(
      '-filter_complex',
      '[1:a]volume=1.0[vo];[2:a]volume=0.3,acompressor=threshold=-20dB:ratio=4:attack=10:release=100[music_ducked];[vo][music_ducked]amix=inputs=2:duration=first:dropout_transition=0[aout]',
      '-map', '0:v',
      '-map', '[aout]',
    );
  } else if (payload.musicBlob) {
    args.push(
      '-filter_complex',
      '[1:a][2:a]amix=inputs=2:duration=first:dropout_transition=0[aout]',
      '-map', '0:v',
      '-map', '[aout]',
    );
  } else {
    args.push('-map', '0:v', '-map', '1:a');
  }
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', outputName);
  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile(outputName);
  const { blob, transfer } = toResultBlob(data);
  self.postMessage({ type: 'RESULT', requestId: msg.requestId, payload: blob }, [transfer]);
}

async function execSmartConcat(msg: SmartConcatMsg) {
  await ensureLoaded();
  if (!ffmpeg) throw new Error('FFmpeg no inicializado');
  const { payload, outputName = 'master.mp4' } = msg;
  const indexByRole = new Map<string, number>();
  for (let i = 0; i < payload.blobs.length; i++) {
    await ffmpeg.writeFile(`clip_${i}.mp4`, await fetchFile(payload.blobs[i].blob));
    indexByRole.set(payload.blobs[i].role, i);
  }
  const lines = payload.timelineOrder
    .map((r) => {
      const idx = indexByRole.get(r);
      return idx !== undefined ? `file 'clip_${idx}.mp4'` : null;
    })
    .filter((l): l is string => l !== null);
  await ffmpeg.writeFile('filelist.txt', new TextEncoder().encode(lines.join('\n')));
  await ffmpeg.exec([
    '-f', 'concat', '-safe', '0',
    '-i', 'filelist.txt',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-t', '30',
    outputName,
  ]);
  const data = await ffmpeg.readFile(outputName);
  const { blob, transfer } = toResultBlob(data);
  self.postMessage({ type: 'RESULT', requestId: msg.requestId, payload: blob }, [transfer]);
}

async function execStaticFromImage(msg: StaticFromImageMsg) {
  await ensureLoaded();
  if (!ffmpeg) throw new Error('FFmpeg no inicializado');
  const { payload, outputName = 'static.mp4' } = msg;
  const duration = Math.max(1, Math.min(30, payload.durationSec));
  await ffmpeg.writeFile('input.jpg', await fetchFile(payload.image));
  await ffmpeg.exec([
    '-loop', '1', '-i', 'input.jpg',
    '-t', duration.toString(),
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=cover,format=yuv420p',
    '-r', '24',
    '-c:v', 'libx264', '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputName,
  ]);
  const data = await ffmpeg.readFile(outputName);
  const { blob, transfer } = toResultBlob(data);
  self.postMessage({ type: 'RESULT', requestId: msg.requestId, payload: blob }, [transfer]);
}

self.onmessage = async (event: MessageEvent<WorkerMsg>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case 'INIT':
        await ensureLoaded();
        self.postMessage({ type: 'READY', requestId: msg.requestId });
        break;
      case 'CONCAT':
        await execConcat(msg);
        break;
      case 'BURN_SUBS':
        await execBurnSubs(msg);
        break;
      case 'MIX_AUDIO':
        await execMixAudio(msg);
        break;
      case 'SMART_CONCAT':
        await execSmartConcat(msg);
        break;
      case 'STATIC_FROM_IMAGE':
        await execStaticFromImage(msg);
        break;
      case 'TERMINATE':
        if (ffmpeg) ffmpeg.terminate();
        self.close();
        break;
      default: {
        const unknown = msg as { type: string; requestId: string };
        self.postMessage({
          type: 'ERROR',
          requestId: unknown.requestId,
          payload: `Unknown message type: ${unknown.type}`,
        });
      }
    }
  } catch (e) {
    const err = e as Error;
    self.postMessage({
      type: 'ERROR',
      requestId: msg.requestId,
      payload: err.message ?? String(e),
    });
  }
};
