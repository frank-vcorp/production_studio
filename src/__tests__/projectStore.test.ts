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
});
