/**
 * Tests para mockImageGen (sandbox determinista de Imagen 3).
 * Spec: ARCH-20260705-04.
 */
import { describe, it, expect } from 'vitest';
import { mockGenerateImage } from '@/services/sandbox/mockImageGen';

describe('sandbox/mockImageGen', () => {
  it('devuelve PNG válido no vacío con mimeType correcto', async () => {
    const out = await mockGenerateImage('test prompt for keyframe OUT');
    expect(out.mimeType).toBe('image/png');
    expect(out.blob).toBeInstanceOf(Blob);
    expect(out.blob.size).toBeGreaterThan(0);
    expect(out.bytesBase64Encoded.length).toBeGreaterThan(0);
  });

  it('bytesBase64Encoded es base64 válido decodificable', async () => {
    const out = await mockGenerateImage('x');
    // Decodificar no debe lanzar
    const decoded = atob(out.bytesBase64Encoded);
    expect(decoded.length).toBeGreaterThan(0);
  });
});