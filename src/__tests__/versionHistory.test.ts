/**
 * Tests para VersionHistoryService.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.4 — 4 tests mínimos.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VersionHistoryService, MAX_VERSIONS_PER_TRANSITION } from '@/services/versionHistory';
import type { PromptVersion } from '@/types/transition';

function makeVersion(version: number, prompt: string, ts = Date.now()): PromptVersion {
  return {
    version,
    prompt,
    approvedAt: ts,
    approvedBy: 'user',
  };
}

describe('VersionHistoryService', () => {
  let service: VersionHistoryService;

  beforeEach(async () => {
    service = new VersionHistoryService();
    // Limpia DB de pruebas anteriores usando un store fresco
    await service.clearTransition('t1');
    await service.clearTransition('t2');
  });

  it('recordVersion guarda y getVersions recupera', async () => {
    const v = makeVersion(1, 'prompt A');
    await service.recordVersion('t1', v);
    const list = await service.getVersions('t1');
    expect(list).toHaveLength(1);
    expect(list[0].version).toBe(1);
    expect(list[0].prompt).toBe('prompt A');
  });

  it('Mantiene máximo MAX_VERSIONS_PER_TRANSITION (FIFO drop oldest)', async () => {
    for (let i = 0; i < MAX_VERSIONS_PER_TRANSITION + 3; i++) {
      await service.recordVersion('t1', makeVersion(i + 1, `prompt ${i}`, Date.now() + i));
    }
    const list = await service.getVersions('t1');
    expect(list).toHaveLength(MAX_VERSIONS_PER_TRANSITION);
    // El más reciente (mayor version) debe estar primero (prepended)
    expect(list[0].version).toBe(MAX_VERSIONS_PER_TRANSITION + 3);
  });

  it('restoreVersion retorna la versión correcta por número de versión', async () => {
    await service.recordVersion('t1', makeVersion(1, 'A'));
    await service.recordVersion('t1', makeVersion(2, 'B'));
    await service.recordVersion('t1', makeVersion(3, 'C'));
    const restored = await service.restoreVersion('t1', 2);
    expect(restored).not.toBeNull();
    expect(restored?.prompt).toBe('B');
    const missing = await service.restoreVersion('t1', 999);
    expect(missing).toBeNull();
  });

  it('generateDiff calcula diff simple line-by-line', () => {
    const oldText = 'línea 1\nlínea 2\nlínea 3';
    const newText = 'línea 1\nlínea 2 modificada\nlínea 3\nlínea 4';
    const diff = service.generateDiff(oldText, newText);
    // Debe marcar removida "línea 2", agregada "línea 2 modificada" y "línea 4"
    expect(diff).toContain('- línea 2');
    expect(diff).toContain('+ línea 2 modificada');
    expect(diff).toContain('+ línea 4');
    expect(diff).toContain('= línea 1');
  });

  it('Deduplica: re-grabar misma version reemplaza (no duplica)', async () => {
    await service.recordVersion('t1', makeVersion(1, 'A'));
    await service.recordVersion('t1', makeVersion(1, 'A modificado'));
    const list = await service.getVersions('t1');
    expect(list).toHaveLength(1);
    expect(list[0].prompt).toBe('A modificado');
  });
});