import { describe, it, expect } from 'vitest';
import { estimateCost, formatCost, estimateETA, formatETA, PRICING_TABLE, PRICING_DISCLAIMER } from '@/services/costEstimator';
import type { CostEstimatorInput } from '@/services/costEstimator';
import type { KeyframeTransition } from '@/types/transition';
import type { Keyframe } from '@/types/keyframe';
import type { MasterBrief } from '@/types/brief';

const sampleBrief: MasterBrief = {
  id: 'brief_test',
  business: {
    name: 'CP Automotriz',
    acronym: 'CPA',
    slogan: 'Restauración premium',
    description: 'Taller',
    sector: 'automotriz',
    audience: 'Dueños',
    differentiators: [],
    logoBlob: null,
  },
  services: [
    {
      id: 'svc_1',
      name: 'Hojalatería',
      description: '',
      keyBenefit: '',
      stages: { attention: '', interest: '', desire: '', action: '' },
    },
    {
      id: 'svc_2',
      name: 'Pintura',
      description: '',
      keyBenefit: '',
      stages: { attention: '', interest: '', desire: '', action: '' },
    },
  ],
  globalVision: {
    style: 'Cinematográfico',
    musicMood: 'upbeat',
    pacing: 'balanceado',
    toneKeywords: ['cercano'],
    avoidKeywords: [],
  },
  createdAt: 0,
  updatedAt: 0,
};

function makeTransition(id: string): KeyframeTransition {
  return {
    id,
    fromKeyframe: 'kf_atencion_in',
    toKeyframe: 'kf_atencion_out',
    nodeKey: 'atencion',
    duration: 4,
    prompt: '',
    cameraSpec: { movement: 'dolly', framing: 'medium', angle: 'eye', speed: 'medium' },
    status: 'approved',
    promptHistory: [],
  };
}

function makeKf(role: string): Keyframe {
  return {
    id: `kf_${role}`,
    role: role as Keyframe['role'],
    label: role,
    description: '',
    source: 'generated_imagen3',
    timestamp: 0,
    status: 'empty',
  };
}

describe('costEstimator', () => {
  const input: CostEstimatorInput = {
    transitions: [makeTransition('t1'), makeTransition('t2'), makeTransition('t3'), makeTransition('t4'), makeTransition('t5'), makeTransition('t6')],
    keyframesNeedGeneration: [makeKf('atencion_out'), makeKf('interes_out'), makeKf('deseo_out')],
    voiceoverText: '',
    voiceoverDurationSec: 30,
    brief: sampleBrief,
  };

  it('estimateCost con 6 transitions + 3 KF + TTS 30s + brief ~1.3k tokens', () => {
    const c = estimateCost(input);
    expect(c.videoClips.count).toBe(6);
    expect(c.videoClips.subtotal).toBeCloseTo(6 * PRICING_TABLE.veo, 5);
    expect(c.imageGeneration.count).toBe(3);
    expect(c.imageGeneration.subtotal).toBeCloseTo(3 * PRICING_TABLE.imagen3, 5);
    expect(c.tts.subtotal).toBeCloseTo(30 * PRICING_TABLE.ttsPerSec, 5);
    expect(c.llm.tokens).toBeGreaterThanOrEqual(1000);
    // Total ≈ 6*0.4 + 3*0.02 + 30*0.001 + 1.3*0.00125 ≈ 2.46 + 0.06 + 0.03 + 0.0016 ≈ 2.55
    expect(c.total).toBeGreaterThan(2.4);
    expect(c.total).toBeLessThan(2.7);
    expect(c.currency).toBe('USD');
  });

  it('formatCost retorna formato USD con 2 decimales', () => {
    const c = estimateCost(input);
    const formatted = formatCost(c);
    expect(formatted).toMatch(/^\$\d+\.\d{2} USD$/);
  });

  it('estimateETA con 6 jobs paralelos 3 slots → < 720s (12 min)', () => {
    const c = estimateCost(input);
    // 6*180 + 3*8 + 4 = 1080 + 24 + 4 = 1108 serial / 3 slots = ~369s
    expect(c.estimatedTotalTimeSec).toBeLessThan(720);
    expect(c.estimatedTotalTimeSec).toBeGreaterThan(300);
  });

  it('disclaimer presente y tokens estimados razonables', () => {
    const c = estimateCost(input);
    expect(c.disclaimer).toContain(PRICING_DISCLAIMER.split('.')[0]);
    expect(c.disclaimer.length).toBeGreaterThan(50);
  });

  it('estimateETA con parallelSlots=1 duplica aproximadamente vs 3 slots', () => {
    const c = estimateCost(input);
    const eta3 = estimateETA(c, 3);
    const eta1 = estimateETA(c, 1);
    expect(eta1).toBeGreaterThan(eta3);
    // ratio debería ser ~3x
    expect(eta1 / eta3).toBeGreaterThan(2.5);
    expect(eta1 / eta3).toBeLessThan(3.5);
  });

  it('formatETA maneja segundos y minutos', () => {
    expect(formatETA(45)).toBe('0:45');
    expect(formatETA(125)).toBe('2:05');
    expect(formatETA(0)).toBe('0:00');
  });
});