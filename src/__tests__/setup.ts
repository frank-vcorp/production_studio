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
