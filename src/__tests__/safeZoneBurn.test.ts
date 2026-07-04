import { describe, it, expect } from 'vitest';
import {
  buildSafeZoneDrawboxFilter,
  hasSafeZoneContent,
} from '@/services/safeZoneBurn';
import { SAFE_ZONES, EXPORT_PRESETS } from '@/types/export';

describe('safeZoneBurn', () => {
  it('hasSafeZoneContent: true para reels (bottom 250 + side 50)', () => {
    expect(hasSafeZoneContent(SAFE_ZONES.reels)).toBe(true);
  });

  it('hasSafeZoneContent: siempre true para shorts (top 50 + bottom 100 + side 30)', () => {
    expect(hasSafeZoneContent(SAFE_ZONES.shorts)).toBe(true);
  });

  it('hasSafeZoneContent: youtube tiene bottom=60', () => {
    expect(hasSafeZoneContent(SAFE_ZONES.youtube)).toBe(true);
  });

  it('buildSafeZoneDrawboxFilter genera drawbox para reels (bottom + sides)', () => {
    const filter = buildSafeZoneDrawboxFilter(SAFE_ZONES.reels, EXPORT_PRESETS['9:16']);
    expect(filter).toContain('drawbox');
    expect(filter).toContain('ih-250'); // bottom 250
    expect(filter).toContain('w=50'); // side 50
  });

  it('buildSafeZoneDrawboxFilter genera solo bottom para youtube (no sides)', () => {
    const filter = buildSafeZoneDrawboxFilter(SAFE_ZONES.youtube, EXPORT_PRESETS['16:9']);
    expect(filter).toContain('ih-60');
    // youtube.sideSafeZone=0, no debe haber drawbox de w=50
    expect(filter).not.toContain('w=50:h=ih:color=yellow');
  });

  it('buildSafeZoneDrawboxFilter ignora top=0', () => {
    const filter = buildSafeZoneDrawboxFilter(SAFE_ZONES.reels, EXPORT_PRESETS['9:16']);
    // reels.topBarHeight=0 → no debe haber un drawbox que use h=0
    expect(filter).not.toMatch(/w=iw:h=0/);
  });
});
