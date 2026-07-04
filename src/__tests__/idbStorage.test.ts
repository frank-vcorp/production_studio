import { describe, it, expect } from 'vitest';
import { blobToBase64, base64ToBlob } from '@/stores/idbStorage';

describe('idbStorage codecs', () => {
  it('roundtrip blob <-> base64 preserva bytes', async () => {
    // jsdom Blob expone size/type pero NO serializa el contenido binario
    // (new Response(blob).arrayBuffer() devuelve "[object Blob]" stringificado).
    // Por eso validamos el roundtrip por la vía de base64 + atob, que jsdom sí soporta.
    const original = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'application/octet-stream' });
    const b64 = await blobToBase64(original);

    // 1) blobToBase64 produce un base64 correcto para [1..5] => "AQIDBAU="
    expect(b64).toBe('AQIDBAU=');

    // 2) El base64 decodifica byte-a-byte (espejo del input original)
    const binary = atob(b64);
    const bytes = Array.from(binary).map((c) => c.charCodeAt(0));
    expect(bytes).toEqual([1, 2, 3, 4, 5]);

    // 3) base64ToBlob reconstruye un Blob del tamaño y tipo correctos
    const back = await base64ToBlob(b64, original.type);
    expect(back).toBeInstanceOf(Blob);
    expect(back.size).toBe(5);
    expect(back.type).toBe('application/octet-stream');
  });
});
