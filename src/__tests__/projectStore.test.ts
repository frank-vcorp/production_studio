import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore, selectApprovedTransitions } from '@/stores/projectStore';
import type { MasterBrief } from '@/types/brief';

// ARCH-20260704-10: projectStore.generateTransition ahora invoca
// generateTransitionWithRetry de services/gemini/video. Mockeamos esa
// función para no hacer HTTP real en tests.
const mockedRetry = vi.fn();
vi.mock('@/services/gemini/video', async () => {
  const actual = await vi.importActual<typeof import('@/services/gemini/video')>(
    '@/services/gemini/video',
  );
  return {
    ...actual,
    generateTransitionWithRetry: (...args: unknown[]) => mockedRetry(...args),
  };
});

import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';

const sampleBrief: MasterBrief = {
  id: 'brief_test',
  business: {
    name: 'CP Automotriz',
    acronym: 'CPA',
    slogan: 'Restauración premium',
    description: 'Taller de colisión y pintura',
    sector: 'automotriz',
    audience: 'Dueños de autos',
    differentiators: ['cabina presurizada', 'pintura horneada'],
    logoBlob: null,
  },
  services: [
    {
      id: 'svc_1',
      name: 'Hojalatería',
      description: 'Reparación de golpes',
      keyBenefit: 'Restauración exacta',
      stages: { attention: 'gancho', interest: 'proceso', desire: 'beneficio', action: 'cta' },
    },
  ],
  globalVision: {
    style: 'Cinematográfico',
    musicMood: 'upbeat',
    pacing: 'balanceado',
    toneKeywords: ['cercano', 'aspiracional'],
    avoidKeywords: [],
  },
  createdAt: 0,
  updatedAt: 0,
};

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('loadBrief popula brief + brandKit + globalStylePrompt', () => {
    const { loadBrief } = useProjectStore.getState();
    loadBrief({ ...sampleBrief, createdAt: 1, updatedAt: 1 });
    const s = useProjectStore.getState();
    expect(s.brief?.business.name).toBe('CP Automotriz');
    expect(s.brandKit?.brandName).toBe('CP Automotriz');
    expect(s.globalStylePrompt.length).toBeGreaterThan(10);
  });

  it('addService añade un servicio y devuelve id', () => {
    const { addService } = useProjectStore.getState();
    const svc = addService();
    expect(svc.id).toMatch(/^svc_/);
    expect(useProjectStore.getState().brief?.services.length ?? 0).toBe(0);
  });

  it('approveTransitionPrompt exige status=approved antes de generar', async () => {
    const { buildTransition, generateTransition, approveTransitionPrompt } = useProjectStore.getState();
    const t = buildTransition('kf_bumper_start', 'kf_atencion_in', 'atencion');
    expect(t).not.toBeNull();
    await expect(generateTransition('trans_atencion')).rejects.toThrow(/aprobado/);
    approveTransitionPrompt('trans_atencion', 'prompt de prueba');
    expect(useProjectStore.getState().transitions.get('trans_atencion')?.status).toBe('approved');
  });

  it('selectApprovedTransitions devuelve los done/approved', () => {
    const { approveTransitionPrompt } = useProjectStore.getState();
    approveTransitionPrompt('trans_atencion', 'p');
    approveTransitionPrompt('trans_interes', 'p');
    const sel = selectApprovedTransitions(useProjectStore.getState());
    expect(sel.length).toBe(2);
  });

  it('resetProject limpia todo el estado', () => {
    const { loadBrief, resetProject } = useProjectStore.getState();
    loadBrief({ ...sampleBrief, createdAt: 1, updatedAt: 1 });
    resetProject();
    expect(useProjectStore.getState().brief).toBeNull();
    expect(useProjectStore.getState().brandKit).toBeNull();
  });

  it('accepts BackgroundJob-like payload via setState (jobQueue integration smoke)', async () => {
    const { useProjectStore } = await import('@/stores/projectStore');
    // Simular que jobQueue marca una transición como done con un clip Blob.
    const blob = new Blob(['clip-mock'], { type: 'video/mp4' });
    const { approveTransitionPrompt } = useProjectStore.getState();
    approveTransitionPrompt('trans_atencion', 'p');
    useProjectStore.setState((s) => {
      const cur = s.transitions.get('trans_atencion');
      if (!cur) return s;
      const nextTrans = new Map(s.transitions);
      const nextClips = new Map(s.clips);
      nextClips.set('trans_atencion', blob);
      nextTrans.set('trans_atencion', { ...cur, videoBlob: blob, status: 'done' });
      return { clips: nextClips, transitions: nextTrans };
    });
    const after = useProjectStore.getState();
    expect(after.clips.get('trans_atencion')?.size).toBeGreaterThan(0);
    expect(after.transitions.get('trans_atencion')?.status).toBe('done');
  });

  // ARCH-20260704-07 + ARCH-20260704-08: al reemplazar la imagen de un
  // keyframe ya analizado/aprobado, deben resetearse COMPLETAMENTE el keyframe
  // (visualAnalysis, intent, description, generationPrompt) y TODAS las
  // transiciones que apuntan al keyframe (prompt, videoBlob, videoUrl,
  // veoOperationId, generatedAt, promptHistory, status → pending) para que
  // vuelva a aparecer el botón "Generar clip" sin estado residual.
  it('uploadKeyframeImage reupload resetea keyframe analizado y transiciones', async () => {
    const { useProjectStore } = await import('@/stores/projectStore');
    const kfId = 'kf_atencion_in';

    // 1. Sembrar keyframe como ya analizado + con visualAnalysis + intent
    //    + generationPrompt (campo introducido en fix ARCH-20260704-08).
    useProjectStore.setState((s) => {
      const cur = s.keyframes.get(kfId);
      if (!cur) return s;
      const next = new Map(s.keyframes);
      next.set(kfId, {
        ...cur,
        status: 'analyzed',
        visualAnalysis: {
          subject: 'auto',
          environment: 'taller',
          lighting: 'natural',
          composition: 'rule of thirds',
          colorPalette: ['#000000'],
          textures: ['metal'],
          cameraPosition: 'eye level',
          depthOfField: 'medium',
          dominantShapes: ['rectangle'],
          technicalNotes: 'mock',
          analyzedAt: Date.now(),
          model: 'gemini-2.5-flash',
          confidence: 0.9,
        },
        humanIntent: 'abrir a motor sucio',
        humanDescription: 'Foto real del problema',
        generationPrompt: 'prompt derivado del análisis viejo',
      });
      return { keyframes: next };
    });

    // 2. Marcar la transición saliente como done con video + prompt final +
    //    operation id + historial de versiones (estado completo post-generación).
    const transId = 'trans_atencion';
    useProjectStore.setState((s) => {
      const cur = s.transitions.get(transId);
      if (!cur) return s;
      const next = new Map(s.transitions);
      next.set(transId, {
        ...cur,
        status: 'done',
        prompt: 'prompt listo para revisión',
        promptFinal: 'prompt final aprobado',
        videoBlob: new Blob(['clip-bytes'], { type: 'video/mp4' }),
        videoUrl: 'blob:http://localhost/clip-old',
        veoOperationId: 'veo_op_123',
        generatedAt: Date.now() - 1000,
        promptHistory: [
          {
            version: 1,
            prompt: 'v1 prompt',
            approvedAt: Date.now() - 2000,
            approvedBy: 'user',
          },
        ],
      });
      return { transitions: next };
    });

    // 3. Llamar uploadKeyframeImage con un nuevo File (pasando isReupload).
    const newFile = new File(['new-image-bytes'], 'replacement.png', { type: 'image/png' });
    await useProjectStore.getState().uploadKeyframeImage('atencion_in', newFile, true);

    // 4. Verificar que el keyframe volvió a 'uploaded' sin derivados.
    const afterKf = useProjectStore.getState().keyframes.get(kfId);
    expect(afterKf?.status).toBe('uploaded');
    expect(afterKf?.visualAnalysis).toBeUndefined();
    expect(afterKf?.humanIntent).toBe('');
    expect(afterKf?.humanDescription).toBe('');
    // ARCH-20260704-08: generationPrompt debe quedar undefined tras el reset.
    expect(afterKf?.generationPrompt).toBeUndefined();
    expect(afterKf?.blob).toBe(newFile);

    // 5. Verificar que la transición saliente volvió a pending y se limpió
    //    COMPLETAMENTE el estado de generación.
    const afterTrans = useProjectStore.getState().transitions.get(transId);
    expect(afterTrans?.status).toBe('pending');
    expect(afterTrans?.prompt).toBe('');
    expect(afterTrans?.promptFinal).toBeUndefined();
    // ARCH-20260704-08: campos agregados al reset completo.
    expect(afterTrans?.videoBlob).toBeUndefined();
    expect(afterTrans?.videoUrl).toBeUndefined();
    expect(afterTrans?.veoOperationId).toBeUndefined();
    expect(afterTrans?.generatedAt).toBeUndefined();
    expect(afterTrans?.promptHistory.length).toBe(0);
  });

  // ARCH-20260704-09: tests para badges persistentes de progreso.
  it('startAnalysisJob crea job en estado analyzing', () => {
    const { startAnalysisJob } = useProjectStore.getState();
    startAnalysisJob('kf_atencion_in');
    const job = useProjectStore.getState().analysisJobs.get('kf_atencion_in');
    expect(job?.state).toBe('analyzing');
    expect(typeof job?.startedAt).toBe('number');
  });

  it('finishAnalysisJob con ok=true marca done, ok=false marca failed con errorMessage', () => {
    const { startAnalysisJob, finishAnalysisJob } = useProjectStore.getState();
    startAnalysisJob('kf_deseo_in');
    finishAnalysisJob('kf_deseo_in', true);
    expect(useProjectStore.getState().analysisJobs.get('kf_deseo_in')?.state).toBe('done');
    expect(useProjectStore.getState().analysisJobs.get('kf_deseo_in')?.errorMessage).toBeUndefined();

    startAnalysisJob('kf_interes_in');
    finishAnalysisJob('kf_interes_in', false, 'fallo de prueba');
    const failed = useProjectStore.getState().analysisJobs.get('kf_interes_in');
    expect(failed?.state).toBe('failed');
    expect(failed?.errorMessage).toBe('fallo de prueba');
  });

  it('startGenerationJob y finishGenerationJob modifican generationJobs', () => {
    const { startGenerationJob, finishGenerationJob } = useProjectStore.getState();
    startGenerationJob('trans_atencion');
    const job = useProjectStore.getState().generationJobs.get('trans_atencion');
    expect(job?.state).toBe('generating');
    expect(typeof job?.startedAt).toBe('number');

    finishGenerationJob('trans_atencion', true, undefined, 2);
    const done = useProjectStore.getState().generationJobs.get('trans_atencion');
    expect(done?.state).toBe('done');
    expect(done?.attempts).toBe(2);

    startGenerationJob('trans_interes');
    finishGenerationJob('trans_interes', false, 'quota exceeded', 5);
    const failed = useProjectStore.getState().generationJobs.get('trans_interes');
    expect(failed?.state).toBe('failed');
    expect(failed?.errorMessage).toBe('quota exceeded');
    expect(failed?.attempts).toBe(5);
  });

  it('partialize NO incluye analysisJobs ni generationJobs (jobs efímeros)', () => {
    // Forzar que existan jobs en el estado.
    useProjectStore.getState().startAnalysisJob('kf_test_a');
    useProjectStore.getState().startGenerationJob('trans_test_g');

    // Inspeccionar manualmente lo que devolvería partialize.
    // Accedemos al storage adapter de zustand para sacar el shape persistido.
    const state = useProjectStore.getState();
    const partializeFn = (useProjectStore as unknown as {
      persist: { getOptions: () => { partialize?: (s: typeof state) => unknown } };
    }).persist.getOptions().partialize;
    expect(partializeFn).toBeDefined();
    const persisted = partializeFn!(state) as Record<string, unknown>;
    expect(persisted.analysisJobs).toBeUndefined();
    expect(persisted.generationJobs).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// ARCH-20260704-10: tests del nuevo generateTransition real (enrola job Veo).
// Suite separada para aislar el mock de services/gemini/video (vi.mock tiene
// efecto global por archivo).
// ────────────────────────────────────────────────────────────────────────────

function setupApprovedTransitionWithKeyframes(transitionId: string) {
  // Sembrar keyframes con blob para que generateTransitionWithRetry
  // reciba data válida.
  const kfFromBlob = new Blob(['kf-from-bytes'], { type: 'image/png' });
  const kfToBlob = new Blob(['kf-to-bytes'], { type: 'image/png' });
  const kfFrom: Keyframe = {
    id: 'kf_atencion_in',
    role: 'atencion_in',
    label: 'IN',
    description: 'Origen',
    source: 'user_upload',
    timestamp: 0,
    status: 'approved',
    blob: kfFromBlob,
    base64: 'data:image/png;base64,aGVsbG8=',
    mimeType: 'image/png',
  };
  const kfTo: Keyframe = {
    id: 'kf_interes_in',
    role: 'interes_in',
    label: 'OUT',
    description: 'Destino',
    source: 'user_upload',
    timestamp: 0,
    status: 'approved',
    blob: kfToBlob,
    base64: 'data:image/png;base64,d29ybGQ=',
    mimeType: 'image/png',
  };
  const trans: KeyframeTransition = {
    id: transitionId,
    fromKeyframe: 'kf_atencion_in',
    toKeyframe: 'kf_interes_in',
    nodeKey: 'atencion',
    duration: 4,
    prompt: 'p',
    cameraSpec: { movement: 'dolly', framing: 'medium', angle: 'eye level', speed: 'medium' },
    status: 'approved',
    promptFinal: 'p',
    promptHistory: [],
  };
  const kfMap = new Map<string, Keyframe>(useProjectStore.getState().keyframes);
  kfMap.set(kfFrom.id, kfFrom);
  kfMap.set(kfTo.id, kfTo);
  const trMap = new Map<string, KeyframeTransition>(useProjectStore.getState().transitions);
  trMap.set(trans.id, trans);
  useProjectStore.setState({ keyframes: kfMap, transitions: trMap });
}

describe('projectStore.generateTransition — ARCH-20260704-10 (job real Veo)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    mockedRetry.mockReset();
  });

  it('enrola generateTransitionWithRetry y setea status=done en éxito', async () => {
    setupApprovedTransitionWithKeyframes('trans_atencion');

    const mockBlob = new Blob(['mock-video'], { type: 'video/mp4' });
    const mockUrl = 'blob:http://localhost/mock-video';
    mockedRetry.mockResolvedValueOnce({
      blob: mockBlob,
      url: mockUrl,
      operationId: 'op_test_123',
      attempts: 1,
      totalLatencyMs: 100,
    });

    await useProjectStore.getState().generateTransition('trans_atencion');

    // generateTransitionWithRetry fue llamado con los snapshots correctos
    expect(mockedRetry).toHaveBeenCalledTimes(1);
    const callArgs = mockedRetry.mock.calls[0]!;
    expect(callArgs[0]?.id).toBe('trans_atencion');
    expect(callArgs[0]?.status).toBe('approved');
    expect(callArgs[1]?.id).toBe('kf_atencion_in');
    expect(callArgs[2]?.id).toBe('kf_interes_in');

    // Estado final: status=done + videoBlob + videoUrl + veoOperationId
    const after = useProjectStore.getState().transitions.get('trans_atencion');
    expect(after?.status).toBe('done');
    expect(after?.videoBlob).toBe(mockBlob);
    expect(after?.videoUrl).toBe(mockUrl);
    expect(after?.veoOperationId).toBe('op_test_123');
    expect(after?.errorMessage).toBeUndefined();
    expect(typeof after?.generatedAt).toBe('number');

    // El clip también debe estar en el mapa clips
    expect(useProjectStore.getState().clips.get('trans_atencion')).toBe(mockBlob);
  });

  it('setea status=failed con errorMessage y re-throw si generateTransitionWithRetry rechaza', async () => {
    setupApprovedTransitionWithKeyframes('trans_atencion');

    mockedRetry.mockRejectedValueOnce(new Error('safety: blocked by policy'));

    await expect(
      useProjectStore.getState().generateTransition('trans_atencion'),
    ).rejects.toThrow(/safety/);

    const after = useProjectStore.getState().transitions.get('trans_atencion');
    expect(after?.status).toBe('failed');
    expect(after?.errorMessage).toContain('safety');
  });

  it('rechaza con mensaje claro si transition.status !== approved', async () => {
    // Estado inicial: trans_atencion está en 'pending'.
    await expect(
      useProjectStore.getState().generateTransition('trans_atencion'),
    ).rejects.toThrow(/aprobado/);

    // No debe haber llamado al service real.
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it('rechaza con mensaje claro si faltan keyframes (fromKf o toKf undefined)', async () => {
    // Aprobar transición pero sin keyframes subidos (estado inicial vacío).
    useProjectStore.getState().approveTransitionPrompt('trans_atencion', 'prompt');
    expect(useProjectStore.getState().transitions.get('trans_atencion')?.status).toBe('approved');

    // El estado inicial tiene keyframes con status='empty' y sin blob.
    // Eso es válido para el check (existen en el Map), por lo que SÍ pasaría
    // la validación de "existencia". Verificamos que al menos el flujo llega
    // hasta invocar generateTransitionWithRetry con snapshots vacíos.
    // Para forzar el path "faltan keyframes", removemos uno del Map.
    useProjectStore.setState((s) => {
      const next = new Map(s.keyframes);
      next.delete('kf_interes_in');
      return { keyframes: next };
    });

    await expect(
      useProjectStore.getState().generateTransition('trans_atencion'),
    ).rejects.toThrow(/Faltan keyframes/);

    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it('no rompe otros estados del store (analysisJobs, brief, etc.) tras generación exitosa', async () => {
    setupApprovedTransitionWithKeyframes('trans_atencion');
    useProjectStore.getState().loadBrief({ ...sampleBrief, createdAt: 1, updatedAt: 1 });

    mockedRetry.mockResolvedValueOnce({
      blob: new Blob(['x'], { type: 'video/mp4' }),
      url: 'blob:x',
      operationId: 'op_x',
      attempts: 1,
      totalLatencyMs: 50,
    });

    await useProjectStore.getState().generateTransition('trans_atencion');

    const s = useProjectStore.getState();
    expect(s.brief?.business.name).toBe('CP Automotriz');
    // Las demás transiciones siguen intactas (no fueron tocadas).
    expect(s.transitions.get('trans_interes')?.status).toBe('pending');
  });
});
