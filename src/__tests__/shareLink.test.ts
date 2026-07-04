import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateShareLink, formatShareLinkExpiry } from '@/services/shareLink';

// jsdom no implementa URL.createObjectURL de forma completa
const mockCreate = vi.fn();
const mockRevoke = vi.fn();

describe('shareLink', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: (b: Blob) => {
        mockCreate(b);
        return `blob:mock/${mockCreate.mock.calls.length}`;
      },
      revokeObjectURL: mockRevoke,
    });
  });
  afterEach(() => {
    mockCreate.mockReset();
    mockRevoke.mockReset();
    vi.unstubAllGlobals();
  });

  it('generateShareLink retorna blob URL válido + QR + embed HTML', async () => {
    const blob = new Blob(['video-data'], { type: 'video/mp4' });
    const out = await generateShareLink({ masterBlob: blob, expiresInHours: 24 });
    expect(out.url).toMatch(/^blob:/);
    expect(out.qrCodeDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(out.embedHtml).toContain('<video');
    expect(out.embedHtml).toContain(out.url);
    expect(out.expiresAt).toBeGreaterThan(Date.now());
  });

  it('formatShareLinkExpiry retorna "24h" para expiración de 24h', () => {
    // Pasamos un `now` fijo para evitar flake por race condition entre Date.now().
    const now = 1_700_000_000_000;
    const expiresAt = now + 24 * 3_600_000;
    expect(formatShareLinkExpiry(expiresAt, now)).toBe('24h');
  });

  it('formatShareLinkExpiry retorna minutos cuando <1h', () => {
    const now = 1_700_000_000_000;
    const expiresAt = now + 30 * 60_000; // 30 min
    expect(formatShareLinkExpiry(expiresAt, now)).toBe('30min');
  });

  it('cleanup revoca el URL', async () => {
    const blob = new Blob(['x'], { type: 'video/mp4' });
    const out = await generateShareLink({ masterBlob: blob, expiresInHours: 1 });
    out.cleanup();
    expect(mockRevoke).toHaveBeenCalledWith(out.url);
  });
});
