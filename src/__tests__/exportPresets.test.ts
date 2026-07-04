import { describe, it, expect } from 'vitest';
import {
  getPreset,
  listAllPresets,
  estimateTotalSizeMB,
  estimateEncodingTime,
} from '@/services/exportPresets';

describe('exportPresets', () => {
  it('listAllPresets retorna los 4 ratios con campos completos', () => {
    const all = listAllPresets();
    expect(all).toHaveLength(4);
    for (const p of all) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.bitrate).toBeGreaterThan(0);
      expect(p.audioBitrate).toBeGreaterThan(0);
      expect(p.estimatedSizeMB).toBeGreaterThan(0);
    }
    const ratios = all.map((p) => p.aspectRatio).sort();
    expect(ratios).toEqual(['16:9', '1:1', '4:5', '9:16'].sort());
  });

  it('estimateTotalSizeMB con ["9:16"] para 30s -> ~19 MB', () => {
    const mb = estimateTotalSizeMB(['9:16'], 30);
    expect(mb).toBeGreaterThanOrEqual(18);
    expect(mb).toBeLessThanOrEqual(20);
  });

  it('estimateEncodingTime con [] -> 0', () => {
    expect(estimateEncodingTime([])).toBe(0);
  });

  it('estimateEncodingTime con 4 ratios en paralelo -> ~18s (no 48s serial)', () => {
    const t = estimateEncodingTime(['9:16', '1:1', '4:5', '16:9']);
    // Parallel model: 12 + 3*2 = 18s (vs serial=48s)
    expect(t).toBeGreaterThanOrEqual(15);
    expect(t).toBeLessThanOrEqual(22);
    expect(t).toBeLessThan(48);
  });

  it('getPreset retorna preset exacto', () => {
    const p = getPreset('16:9');
    expect(p.width).toBe(1920);
    expect(p.height).toBe(1080);
    expect(p.platform).toBe('youtube');
  });
});
