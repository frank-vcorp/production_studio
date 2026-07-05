import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, selectApprovedTransitions } from '@/stores/projectStore';
import type { MasterBrief } from '@/types/brief';

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
          model: 'gemini-2.5-pro-vision',
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
});
