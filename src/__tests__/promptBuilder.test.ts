import { describe, it, expect } from 'vitest';
import {
  buildKeyframeTransitionPrompt,
  buildImage3Prompt,
  formatVisualAnalysisForPrompt,
  buildCameraMovement,
  buildTTSPrompt,
  __NO_INVENTE_RULE,
} from '@/services/promptBuilder';
import type { Keyframe } from '@/types/keyframe';
import type { CameraSpec, VisualAnalysis } from '@/types/keyframe';

const makeKf = (over: Partial<Keyframe> = {}): Keyframe => ({
  id: over.id ?? 'kf_test',
  role: over.role ?? 'atencion_in',
  label: over.label ?? 'Test',
  description: 'test',
  source: 'user_upload',
  base64: 'abc',
  mimeType: 'image/png',
  timestamp: 0,
  status: 'analyzed',
  visualAnalysis: over.visualAnalysis,
  ...over,
});

const fakeVA: VisualAnalysis = {
  subject: 'Llantas en taller con grasa visible',
  environment: 'Piso de cemento gris con herramientas colgadas al fondo',
  lighting: 'Luz cenital fría, sombras duras',
  composition: 'Plano general, regla tercios aplicada al neumático',
  colorPalette: ['#1a1a1a', '#5a5a5a', '#c0392b'],
  textures: ['metal cepillado', 'goma', 'aceite'],
  cameraPosition: 'Frontal medio',
  depthOfField: 'medium',
  dominantShapes: ['círculo', 'rectángulo'],
  technicalNotes: 'No hay personas visibles, manchas de aceite marcadas',
  analyzedAt: 0,
  model: 'gemini-2.5-flash',
  confidence: 0.92,
};

const cam: CameraSpec = { movement: 'crane up', framing: 'macro', angle: 'low angle', speed: 'slow' };

describe('promptBuilder', () => {
  it('NO_INVENTE_RULE contiene la regla explícita', () => {
    expect(__NO_INVENTE_RULE).toMatch(/NO INVENTES/i);
    expect(__NO_INVENTE_RULE).toMatch(/anclas visuales/i);
  });

  it('formatVisualAnalysisForPrompt incluye las anclas INICIAL/FINAL', () => {
    const fromText = formatVisualAnalysisForPrompt(fakeVA, 'INICIAL');
    const toText = formatVisualAnalysisForPrompt(undefined, 'FINAL');
    expect(fromText).toMatch(/\[ANCLA INICIAL\]/);
    expect(toText).toMatch(/\[ANCLA FINAL\]/);
    expect(toText).toMatch(/sin análisis visual/i);
    expect(fromText).toMatch(/Llantas en taller/);
  });

  it('buildCameraMovement refleja movement + framing + angle + speed en español', () => {
    const out = buildCameraMovement(cam, 'deseo');
    // ARCH-20260704-09: localization a español.
    expect(out).toContain('Movimiento de cámara:');
    expect(out).not.toContain('Camera:');
    expect(out).toContain('crane up');
    expect(out).toContain('macro');
    expect(out).toContain('low angle');
    expect(out).toContain('cámara lenta (24fps)');
  });

  it('buildKeyframeTransitionPrompt incluye regla + 2 anclas + intención + cámara en español', () => {
    const from = makeKf({ visualAnalysis: fakeVA });
    const to = makeKf({ id: 'kf_out', role: 'atencion_out', label: 'Atención OUT', visualAnalysis: { ...fakeVA, technicalNotes: 'cuadro final' } });
    const prompt = buildKeyframeTransitionPrompt({
      fromKf: from,
      toKf: to,
      nodeKey: 'atencion',
      cameraSpec: cam,
      humanIntent: 'mostrar motor sucio',
      brandKit: { brandName: 'X', tone: ['cercano', 'aspiracional'], palette: { primary: '', secondary: '', accent: '', bg: '', fg: '' }, fonts: { heading: '', body: '', mono: '' } },
      brief: null,
      serviceNodeText: 'Atención al cliente',
    });

    expect(prompt).toContain('NO INVENTES');
    expect(prompt).toContain('INICIAL');
    expect(prompt).toContain('FINAL');
    expect(prompt).toContain('crane up');
    expect(prompt).toContain('mostrar motor sucio');
    expect(prompt).toContain('Atención al cliente');
    expect(prompt).toContain('9:16');
    expect(prompt).toContain('Formato vertical');
    // ARCH-20260704-09: asegurar localizaciones en español.
    expect(prompt).not.toContain('Brand voice:');
    expect(prompt).not.toContain('Camera:');
    expect(prompt).not.toContain('Aspecto 9:16.');
    expect(prompt).toContain('Movimiento de cámara:');
    expect(prompt).toContain('Tono de marca:');
  });

  it('buildKeyframeTransitionPrompt expande nodo AIDA cuando no hay serviceNodeText', () => {
    const from = makeKf({ visualAnalysis: fakeVA });
    const to = makeKf({ id: 'kf_out', role: 'atencion_out', label: 'Atención OUT', visualAnalysis: fakeVA });
    const prompt = buildKeyframeTransitionPrompt({
      fromKf: from,
      toKf: to,
      nodeKey: 'atencion',
      cameraSpec: cam,
      humanIntent: 'mostrar motor sucio',
      brandKit: null,
      brief: null,
      serviceNodeText: undefined,
    });
    expect(prompt).toContain('Attention / Interest / Desire / Action');
    expect(prompt).toContain('«atencion»');
  });

  it('buildImage3Prompt incluye regla + ancla + transformación en español', () => {
    const kf = makeKf({ visualAnalysis: fakeVA });
    const prompt = buildImage3Prompt({
      kfIn: kf,
      intent: 'ampliar al motor',
      cameraSpec: cam,
      visualAnalysis: fakeVA,
      brief: null,
      brandKit: null,
    });
    expect(prompt).toContain('CONTINUACIÓN DIRECTA');
    expect(prompt).toContain('NO INVENTES');
    expect(prompt).toContain('ampliar al motor');
    expect(prompt).toContain('cinematográfico');
    // ARCH-20260704-09: mantener regla mayúsculas Imagen 3 + texto en español.
    expect(prompt).toContain('GENERA');
    expect(prompt).toContain('Salida en formato vertical');
  });

  it('buildTTSPrompt devuelve voice config en español', () => {
    const out = buildTTSPrompt({ voiceover: 'Hola mundo' });
    expect(out.text).toBe('Hola mundo');
    expect(out.languageCode).toBe('es-MX');
    expect(typeof out.voiceName).toBe('string');
  });
});
