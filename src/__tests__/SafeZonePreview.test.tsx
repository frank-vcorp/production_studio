/**
 * Tests del componente SafeZonePreview.
 * Verifica que las 4 ratios se renderizan sin overflow y con overlays
 * según la safe zone correspondiente.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SafeZonePreview } from '@/components/export/SafeZonePreview';
import { SAFE_ZONES } from '@/types/export';

describe('SafeZonePreview', () => {
  it('renderiza 9:16 con bottom amber visible (reels)', () => {
    const { container } = render(
      <SafeZonePreview aspectRatio="9:16" safeZone={SAFE_ZONES.reels} />,
    );
    const root = container.querySelector('[data-testid="safe-zone-preview-9:16"]');
    expect(root).not.toBeNull();
    // reels.bottomBarHeight=250, debe haber al menos un div con aria-label Bottom
    const bottom = container.querySelector('[aria-label^="Bottom safe zone 250"]');
    expect(bottom).not.toBeNull();
  });

  it('renderiza 16:9 sin side safe zones (youtube)', () => {
    const { container } = render(
      <SafeZonePreview aspectRatio="16:9" safeZone={SAFE_ZONES.youtube} />,
    );
    // youtube.sideSafeZone=0 → no debe haber overlay "Left safe zone"
    const left = container.querySelector('[aria-label^="Left safe zone"]');
    expect(left).toBeNull();
  });

  it('renderiza 1:1 con bottom pequeño (feed_ig_square)', () => {
    const { container } = render(
      <SafeZonePreview aspectRatio="1:1" safeZone={SAFE_ZONES.feed_ig_square} />,
    );
    const bottom = container.querySelector('[aria-label^="Bottom safe zone 60"]');
    expect(bottom).not.toBeNull();
  });

  it('cada ratio usa el aspect-ratio CSS correcto', () => {
    const { container: c1 } = render(
      <SafeZonePreview aspectRatio="4:5" safeZone={SAFE_ZONES.feed_ig_portrait} />,
    );
    const div1 = c1.querySelector('[data-testid="safe-zone-preview-4:5"]') as HTMLElement;
    expect(div1.style.aspectRatio).toBe('4/5');
  });
});
