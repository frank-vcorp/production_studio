/**
 * Helpers de descarga.
 * Spec: SPEC-S6-TESTS-CICD §6.1.
 *
 * ID: IMPL-20260704-06.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { downloadBlob, downloadJSON } from '@/utils/download';

describe('downloadBlob', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('crea anchor clickeable con URL.createObjectURL', () => {
    const revoke = vi.fn();
    const createUrl = vi.fn(() => 'blob:fake');
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revoke;

    const blob = new Blob(['hello'], { type: 'text/plain' });
    downloadBlob(blob, 'foo.txt');

    expect(createUrl).toHaveBeenCalledWith(blob);
    const a = document.querySelector('a');
    expect(a).not.toBeNull();
    expect(a?.getAttribute('download')).toBe('foo.txt');
    expect(a?.getAttribute('href')).toBe('blob:fake');

    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });

  it('remueve el anchor tras timeout', () => {
    vi.useFakeTimers();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = vi.fn();

    downloadBlob(new Blob(['x']), 'x.txt');
    expect(document.querySelector('a')).not.toBeNull();
    vi.advanceTimersByTime(150);
    expect(document.querySelector('a')).toBeNull();

    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });
});

describe('downloadJSON', () => {
  it('genera Blob JSON con indent', () => {
    const origCreate = URL.createObjectURL;
    let captured: Blob | undefined;
    URL.createObjectURL = (b: Blob) => { captured = b; return 'blob:j'; };
    URL.revokeObjectURL = vi.fn();

    downloadJSON({ hola: 'mundo', n: 1 }, 'data.json');
    expect(captured).toBeDefined();
    expect(captured!.type).toBe('application/json');

    URL.createObjectURL = origCreate;
  });
});
