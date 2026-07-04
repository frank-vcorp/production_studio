import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildExportPackZip } from '@/services/zipHelper';
import type { ExportPackOutput } from '@/types/export';

const fakeVideoBlob = (txt: string) =>
  new Blob([txt.padEnd(1024, '0')], { type: 'video/mp4' });

describe('zipHelper', () => {
  it('ZIP contiene los vídeos, subs, VO, manifest y README.txt', async () => {
    const pack: Partial<ExportPackOutput> = {
      videos: [
        { aspectRatio: '9:16', blob: fakeVideoBlob('aaa'), sizeMB: 0.001, filename: 'master_9x16.mp4' },
        { aspectRatio: '1:1', blob: fakeVideoBlob('bbb'), sizeMB: 0.001, filename: 'master_1x1.mp4' },
      ],
      subtitles: { srtBlob: new Blob(['1\n00:00:00,000 --> 00:00:01,000\nhola'], { type: 'application/x-subrip' }), filename: 'subs.srt' },
      voAudio: { wavBlob: new Blob(['vo']), filename: 'vo.wav' },
      manifest: { jsonBlob: new Blob(['{}']), filename: 'manifest.json' },
    };
    const result = await buildExportPackZip(pack, undefined, 30);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.filename).toMatch(/^bridge_pack_/);
    // Re-leer el ZIP y verificar archivos internos
    const zip = await JSZip.loadAsync(result.blob);
    const names = Object.keys(zip.files);
    expect(names).toContain('master_9x16.mp4');
    expect(names).toContain('master_1x1.mp4');
    expect(names).toContain('subs.srt');
    expect(names).toContain('vo.wav');
    expect(names).toContain('manifest.json');
    expect(names).toContain('README.txt');
    const readme = await zip.file('README.txt')?.async('string');
    expect(readme).toContain('Bridge Creative Engine — Export Pack');
    expect(readme).toContain('Total videos: 2');
  });

  it('ZIP vacío (sin vídeos) sigue generando README', async () => {
    const pack: Partial<ExportPackOutput> = {};
    const result = await buildExportPackZip(pack, undefined, 0);
    const zip = await JSZip.loadAsync(result.blob);
    expect(Object.keys(zip.files)).toContain('README.txt');
    const readme = await zip.file('README.txt')?.async('string');
    expect(readme).toContain('Total videos: 0');
  });
});
