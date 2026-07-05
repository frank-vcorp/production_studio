/**
 * Tests para SplitViewHost — callbacks granulares con ADR-04 gate.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.7 + IMPL-20260704-01 (H1 fix).
 *
 * Verifica:
 *  1. Click "Regenerar Visual" con status='approved' → llama approve + generate
 *  2. Click "Regenerar Visual" con status='draft' → muestra error toast, NO regenera (GATE)
 *  3. Click "Regenerate VO" → llama TTS segment + actualiza preview
 *  4. Click "Update Subtitles" → regenera VTT para segmento
 *  5. Error en regenerate → muestra error toast + cleanup loading state
 *
 * Estrategia: mockeamos `@/services/promptBuilder` y `@/services/versionHistory`
 * para que el test sea determinístico. `useProjectStore` real (fake-indexeddb).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mocks ANTES de importar SplitViewHost
vi.mock('@/services/promptBuilder', () => ({
  buildKeyframeTransitionPrompt: vi.fn((input) => `MOCK_PROMPT:${input.humanIntent ?? 'no-intent'}`),
}));

vi.mock('@/services/versionHistory', () => {
  const versions = new Map<string, Array<{ version: number; prompt: string; approvedAt: number; approvedBy: string; changeReason?: string }>>();
  return {
    versionHistory: {
      recordVersion: vi.fn(async (tid: string, v: { version: number; prompt: string; approvedAt: number; approvedBy: string; changeReason?: string }) => {
        const cur = versions.get(tid) ?? [];
        const next = [v, ...cur.filter((x) => x.version !== v.version)].slice(0, 5);
        versions.set(tid, next);
      }),
      getVersions: vi.fn(async (tid: string) => versions.get(tid) ?? []),
      generateDiff: vi.fn(() => 'mock-diff'),
    },
  };
});

// ARCH-20260704-10: mockear generateTransitionWithRetry para que
// SplitViewHost tests no intenten HTTP real cuando projectStore.generateTransition
// ejecuta el flujo real.
vi.mock('@/services/gemini/video', async () => {
  const actual = await vi.importActual<typeof import('@/services/gemini/video')>(
    '@/services/gemini/video',
  );
  return {
    ...actual,
    generateTransitionWithRetry: vi.fn(async () => ({
      blob: new Blob(['mock-clip-bytes'], { type: 'video/mp4' }),
      url: 'blob:http://localhost/mock-clip',
      operationId: 'op_mock',
      attempts: 1,
      totalLatencyMs: 10,
    })),
  };
});

import { SplitViewHost } from '@/components/generation/SplitViewHost';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { versionHistory } from '@/services/versionHistory';
import { buildKeyframeTransitionPrompt } from '@/services/promptBuilder';
import type { Keyframe, CameraSpec } from '@/types/keyframe';
import type { KeyframeTransition } from '@/types/transition';

const cameraSpec: CameraSpec = {
  movement: 'dolly out',
  framing: 'medium',
  angle: 'eye level',
  speed: 'medium',
};

const kfFrom: Keyframe = {
  id: 'kf_from',
  role: 'deseo_in',
  label: 'IN',
  description: 'Real',
  source: 'user_upload',
  timestamp: 0,
  status: 'approved',
  base64: 'data:image/png;base64,iVBORw0KGgo=',
  mimeType: 'image/png',
};

const kfTo: Keyframe = {
  id: 'kf_to',
  role: 'deseo_out',
  label: 'OUT',
  description: 'Auto',
  source: 'generated_imagen3',
  timestamp: 0,
  status: 'generated',
};

const baseTransition: KeyframeTransition = {
  id: 'trans_deseo',
  fromKeyframe: 'kf_from',
  toKeyframe: 'kf_to',
  nodeKey: 'deseo',
  duration: 7,
  prompt: 'prompt-original',
  cameraSpec,
  status: 'approved',
  videoUrl: 'blob:test',
  promptHistory: [],
};

function setupProjectStore(transition: KeyframeTransition) {
  const kfMap = new Map<string, Keyframe>();
  kfMap.set(kfFrom.id, kfFrom);
  kfMap.set(kfTo.id, kfTo);
  const trMap = new Map<string, KeyframeTransition>();
  trMap.set(transition.id, transition);

  useProjectStore.setState({
    keyframes: kfMap,
    transitions: trMap,
  });
}

function setupUISplitView(transitionId: string) {
  useUIStore.setState({ splitViewTransitionId: transitionId });
}

function teardown() {
  useUIStore.setState({ splitViewTransitionId: null });
  useProjectStore.getState().resetProject();
  vi.mocked(versionHistory.recordVersion).mockClear();
  vi.mocked(buildKeyframeTransitionPrompt).mockClear();
}

function getLatestToasts() {
  return useUIStore.getState().toasts;
}

describe('<SplitViewHost /> — ADR-04 Gate (H1 fix)', () => {
  beforeEach(() => {
    teardown();
  });

  afterEach(() => {
    teardown();
  });

  it('Test 1: Click "Regenerar Visual" con status="approved" → llama approve + generate', async () => {
    setupProjectStore({ ...baseTransition, status: 'approved' });
    setupUISplitView('trans_deseo');

    render(<SplitViewHost />);

    const textarea = screen.getByTestId('visual-intent') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'abrir a motor sucio' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('regenerate-visual'));
    });

    await waitFor(() => {
      expect(buildKeyframeTransitionPrompt).toHaveBeenCalled();
    });

    // Verificar que promptBuilder se llamó con la nueva intent
    expect(buildKeyframeTransitionPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ humanIntent: 'abrir a motor sucio' }),
    );

    // Verificar que versionHistory grabó la nueva versión
    expect(versionHistory.recordVersion).toHaveBeenCalledWith(
      'trans_deseo',
      expect.objectContaining({
        changeReason: 'regenerate-visual: abrir a motor sucio',
      }),
    );

    // Verificar que la transición quedó en estado terminal (done) tras
    // la generación real (mocked). ARCH-20260704-10.
    expect(useProjectStore.getState().transitions.get('trans_deseo')?.status).toBe('done');

    // Verificar success toast
    const toasts = getLatestToasts();
    const success = toasts.find((t) => t.kind === 'success' && /Visual regenerado/.test(t.message));
    expect(success).toBeDefined();
  });

  it('Test 2: Click "Regenerar Visual" con status="pending" → muestra error toast, NO regenera (GATE)', async () => {
    setupProjectStore({ ...baseTransition, status: 'pending' });
    setupUISplitView('trans_deseo');

    render(<SplitViewHost />);

    const textarea = screen.getByTestId('visual-intent') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'cualquier intent' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('regenerate-visual'));
    });

    // promptBuilder NO debe haberse llamado (gate bloquea)
    expect(buildKeyframeTransitionPrompt).not.toHaveBeenCalled();
    expect(versionHistory.recordVersion).not.toHaveBeenCalled();

    // Status NO debe haber cambiado a 'generating'
    expect(useProjectStore.getState().transitions.get('trans_deseo')?.status).toBe('pending');

    // Toast de error
    const toasts = getLatestToasts();
    const errorToast = toasts.find((t) => t.kind === 'error' && /Aprueba el prompt/.test(t.message));
    expect(errorToast).toBeDefined();
  });

  it('Test 2b: Status "draft" también bloquea (cualquier != approved)', async () => {
    setupProjectStore({ ...baseTransition, status: 'draft' as KeyframeTransition['status'] });
    setupUISplitView('trans_deseo');

    render(<SplitViewHost />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('regenerate-visual'));
    });

    expect(buildKeyframeTransitionPrompt).not.toHaveBeenCalled();
    expect(useProjectStore.getState().transitions.get('trans_deseo')?.status).toBe('draft');
  });

  it('Test 3: Click "Regenerate VO" → actualiza subtitles en store + versiona', async () => {
    setupProjectStore({ ...baseTransition, status: 'approved' });
    setupUISplitView('trans_deseo');

    render(<SplitViewHost />);

    // Ir al tab VO
    fireEvent.click(screen.getByTestId('tab-vo'));

    const voText = screen.getByTestId('vo-text') as HTMLTextAreaElement;
    fireEvent.change(voText, { target: { value: 'Hojalatería premium en 7 días' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('regenerate-vo'));
    });

    await waitFor(() => {
      expect(versionHistory.recordVersion).toHaveBeenCalled();
    });

    // El store debe tener subtitles nuevo con el texto
    const subs = useProjectStore.getState().subtitles;
    expect(subs).not.toBeNull();
    expect(subs?.segments[0].text).toBe('Hojalatería premium en 7 días');

    // Versión registrada con changeReason
    expect(versionHistory.recordVersion).toHaveBeenCalledWith(
      'trans_deseo',
      expect.objectContaining({
        changeReason: expect.stringContaining('regenerate-vo:'),
      }),
    );

    // Toast de éxito
    const toasts = getLatestToasts();
    const ok = toasts.find((t) => t.kind === 'success' && /Voz regenerada/.test(t.message));
    expect(ok).toBeDefined();
  });

  it('Test 4: Click "Update Subtitles" → regenera VTT para segmento + versiona', async () => {
    setupProjectStore({ ...baseTransition, status: 'approved' });
    setupUISplitView('trans_deseo');

    render(<SplitViewHost />);

    // Ir al tab Subs
    fireEvent.click(screen.getByTestId('tab-subs'));

    const subsText = screen.getByTestId('subs-text') as HTMLTextAreaElement;
    fireEvent.change(subsText, { target: { value: 'Subtítulo de prueba S4' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('update-subs'));
    });

    await waitFor(() => {
      expect(versionHistory.recordVersion).toHaveBeenCalled();
    });

    const subs = useProjectStore.getState().subtitles;
    expect(subs).not.toBeNull();
    expect(subs?.vtt).toContain('Subtítulo de prueba S4');
    expect(subs?.segments.some((s) => s.text === 'Subtítulo de prueba S4')).toBe(true);

    expect(versionHistory.recordVersion).toHaveBeenCalledWith(
      'trans_deseo',
      expect.objectContaining({
        changeReason: expect.stringContaining('update-subtitles:'),
      }),
    );
  });

  it('Test 5: Error en regenerate → muestra error toast + cleanup loading state', async () => {
    // Forzar error: versionHistory.recordVersion rechaza
    vi.mocked(versionHistory.recordVersion).mockRejectedValueOnce(new Error('IDB write fail'));

    setupProjectStore({ ...baseTransition, status: 'approved' });
    setupUISplitView('trans_deseo');

    render(<SplitViewHost />);

    const textarea = screen.getByTestId('visual-intent') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'intent' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('regenerate-visual'));
    });

    // Toast de error
    await waitFor(() => {
      const toasts = getLatestToasts();
      const errToast = toasts.find(
        (t) => t.kind === 'error' && /Error al regenerar visual/.test(t.message),
      );
      expect(errToast).toBeDefined();
    });

    // Loading state cleanup: el botón debe volver a estar enabled (no permanentemente busy).
    // Después de un error, un nuevo click debe poder dispararse sin estar "atascado".
    const button = screen.getByTestId('regenerate-visual') as HTMLButtonElement;
    expect(button).not.toBeDisabled();

    // Reintentemos: ahora versionHistory funciona de nuevo
    vi.mocked(versionHistory.recordVersion).mockResolvedValueOnce(undefined);

    await act(async () => {
      fireEvent.click(button);
    });

    // Debe haber un nuevo attempt
    await waitFor(() => {
      expect(buildKeyframeTransitionPrompt).toHaveBeenCalledTimes(2);
    });
  });

  // ARCH-20260704-10: flujo handleApprove → generateTransition (real) →
  // finishGenerationJob(true) end-to-end. El nuevo projectStore.generateTransition
  // invoca generateTransitionWithRetry (mocked aquí) y resuelve con blob + url.
  it('Test 6: handleApprove ejecuta Veo real y marca generationJob done', async () => {
    const transitionId = 'trans_deseo';
    setupProjectStore({ ...baseTransition, status: 'pending', prompt: 'old-prompt' });
    setupUISplitView(transitionId);

    render(<SplitViewHost />);

    // Trigger handleApprove vía el botón "Aprobar prompt" del editor.
    const approveBtn = screen.getByTestId('approve-btn');
    await act(async () => {
      fireEvent.click(approveBtn);
    });

    // Tras la aprobación + generación, la transición debe estar en 'done'.
    await waitFor(() => {
      expect(useProjectStore.getState().transitions.get(transitionId)?.status).toBe('done');
    });

    // El generationJob debe estar marcado como done con attempts poblados.
    const job = useProjectStore.getState().generationJobs.get(transitionId);
    expect(job?.state).toBe('done');
    expect(job?.errorMessage).toBeUndefined();

    // El video blob debe haberse persistido en el store.
    const blob = useProjectStore.getState().transitions.get(transitionId)?.videoBlob;
    expect(blob).toBeDefined();

    // El split view debe haberse cerrado.
    expect(useUIStore.getState().splitViewTransitionId).toBeNull();
  });
});
