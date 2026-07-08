import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// Stub para TextEncoder/Decoder si jsdom no los trae (Node 20+ los trae por defecto)
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('node:util');
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}

// jsdom no implementa fetch básico — Node 22 ya trae `fetch` global.
if (typeof globalThis.fetch === 'undefined') {
  try {
    const mod = await import('node:fetch' as string);
    globalThis.fetch = (mod as { default: typeof fetch }).default;
  } catch {
    // fetch global ya inyectado por vitest en Node 22+
  }
}

// Polyfill de crypto.randomUUID
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  const { webcrypto } = await import('node:crypto');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// Polyfill de OffscreenCanvas para jsdom (ARCH-20260705-04 sandbox).
// jsdom tiene HTMLCanvasElement pero no OffscreenCanvas. Implementamos un
// polyfill mínimo basado en document.createElement('canvas').
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  class JsdomOffscreenCanvas {
    width: number;
    height: number;
    private _canvas: HTMLCanvasElement;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this._canvas = document.createElement('canvas');
      this._canvas.width = width;
      this._canvas.height = height;
    }
    getContext(type: '2d'): CanvasRenderingContext2D | null {
      return this._canvas.getContext(type);
    }
    async convertToBlob(opts?: { type?: string }): Promise<Blob> {
      return new Promise<Blob>((resolve, reject) => {
        this._canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
          opts?.type ?? 'image/png',
        );
      });
    }
  }
  (globalThis as unknown as { OffscreenCanvas: typeof OffscreenCanvas }).OffscreenCanvas =
    JsdomOffscreenCanvas as unknown as typeof OffscreenCanvas;
}

// Polyfill Blob.arrayBuffer() para jsdom (jsdom Blob usa FileReader en su lugar).
// ARCH-20260705-04: los mocks del sandbox lo usan para convertir PNG a base64.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result instanceof ArrayBuffer) resolve(reader.result);
        else reject(new Error('FileReader no devolvió ArrayBuffer'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
      reader.readAsArrayBuffer(this);
    });
  };
}
