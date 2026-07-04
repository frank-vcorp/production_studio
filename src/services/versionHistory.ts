/**
 * VersionHistoryService — persistencia de las últimas 5 versiones de prompt
 * por transición AIDA, en IndexedDB store `bridge-versions`.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.4.
 *
 * Schema (store 'versions' en DB 'bridge-versions' v1):
 *   - key: transitionId (string)
 *   - value: { versions: PromptVersion[] }   // FIFO max 5
 *
 * El servicio es singleton (`versionHistory`). Provee:
 *   - recordVersion(tid, version): añade y trunca a 5
 *   - getVersions(tid): lee lista
 *   - restoreVersion(tid, vid): busca por id
 *   - generateDiff(old, new): diff simple line-by-line (sin librería externa)
 *
 * Nota: usa `fake-indexeddb` en tests (ya configurado en setup.ts).
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { PromptVersion } from '@/types/transition';

export interface VersionRecord {
  transitionId: string;
  versions: PromptVersion[];
}

export const MAX_VERSIONS_PER_TRANSITION = 5;

const DB_NAME = 'bridge-versions';
const STORE = 'versions';
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'transitionId' });
        }
      },
    });
  }
  return dbPromise;
}

export class VersionHistoryService {
  /** Añade una versión al inicio de la lista (FIFO drop oldest). */
  async recordVersion(transitionId: string, version: PromptVersion): Promise<void> {
    if (!transitionId) throw new Error('transitionId requerido');
    if (!version) throw new Error('version requerido');
    const db = await getDB();
    const tx = db.transaction(STORE, 'readwrite');
    const existing = (await tx.store.get(transitionId)) as VersionRecord | undefined;
    const prevList = existing?.versions ?? [];
    // dedupe por version (campo único del modelo S1) + prepend + truncate
    const next = [version, ...prevList.filter((v) => v.version !== version.version)].slice(
      0,
      MAX_VERSIONS_PER_TRANSITION,
    );
    await tx.store.put({ transitionId, versions: next } as VersionRecord);
    await tx.done;
  }

  /** Lee todas las versiones (orden newest-first). */
  async getVersions(transitionId: string): Promise<PromptVersion[]> {
    if (!transitionId) return [];
    const db = await getDB();
    const rec = (await db.get(STORE, transitionId)) as VersionRecord | undefined;
    return rec?.versions ?? [];
  }

  /** Restaura una versión específica (lookup por número de versión). */
  async restoreVersion(
    transitionId: string,
    versionNumber: number,
  ): Promise<PromptVersion | null> {
    const list = await this.getVersions(transitionId);
    return list.find((v) => v.version === versionNumber) ?? null;
  }

  /** Borra todas las versiones de una transición. Utilidad de test. */
  async clearTransition(transitionId: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE, transitionId);
  }

  /**
   * Diff simple línea-por-línea (sin librería externa).
   * Devuelve un string con prefijos +/-/= para mostrar en UI.
   */
  generateDiff(oldPrompt: string, newPrompt: string): string {
    const oldLines = oldPrompt.split('\n');
    const newLines = newPrompt.split('\n');
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);
    const out: string[] = [];

    for (const l of oldLines) {
      if (!newSet.has(l)) out.push(`- ${l}`);
      else out.push(`= ${l}`);
    }
    for (const l of newLines) {
      if (!oldSet.has(l)) out.push(`+ ${l}`);
    }
    return out.join('\n');
  }
}

/** Singleton — el hook consume esta instancia directamente. */
export const versionHistory = new VersionHistoryService();