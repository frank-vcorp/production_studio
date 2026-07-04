/**
 * Adaptador de storage para Zustand persist basado en IndexedDB (idb).
 * Serializa Blobs <-> base64 para supervivencia en F5.
 * Spec: SPEC-S1-FOUNDATION §1.4 + ARCH-20260703-01 §5.
 */

import { type StateStorage } from 'zustand/middleware';
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'bridge-project';
const STORE = 'kv';
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Almacenamiento string-based sobre IndexedDB.
 * Compatible con `createJSONStorage(() => idbStorage)`.
 */
export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await getDB();
      const value = await db.get(STORE, name);
      if (value == null) return null;
      return typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const db = await getDB();
    await db.put(STORE, value, name);
  },
  removeItem: async (name: string): Promise<void> => {
    const db = await getDB();
    await db.delete(STORE, name);
  },
};

/**
 * Convierte un Blob a base64 con FileReader (async).
 * Usado antes de persistir en IDB si el state tiene Blob directo.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      } else {
        reject(new Error('FileReader did not return a string'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/** Inversa de blobToBase64 */
export async function base64ToBlob(base64: string, mimeType: string): Promise<Blob> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * Reconstruye Blobs a partir de sentinel { __type: 'Blob', base64, mimeType }.
 * Después de hidratar el store, llamar a hydrateBlobs(state) para materializar.
 */
export function reconstructBlobs<T>(input: T): T {
  if (input == null) return input;
  if (Array.isArray(input)) {
    return input.map((v) => reconstructBlobs(v)) as unknown as T;
  }
  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if ((obj as { __type?: string }).__type === 'Blob') {
      // Sentinel: la hidratación real es async en onRehydrateStorage del store.
      return input;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = reconstructBlobs(v);
    return out as unknown as T;
  }
  return input;
}
