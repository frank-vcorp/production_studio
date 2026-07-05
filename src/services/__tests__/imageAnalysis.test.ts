import { describe, it, expect } from 'vitest';
import { analyzeImageForVision } from '@/services/gemini/imageAnalysis';
import { GeminiProxyError } from '@/services/gemini/client';

describe('imageAnalysis (ARCH-20260704-09)', () => {
  it('validateAnalysis lanza error en español para body no-objeto', async () => {
    // analyzeImageForVision orquesta geminiClient.analyzeImage + validate.
    // Como el proxy real no está disponible en este test environment, mockeamos
    // el cliente Gemini para forzar la rama de error.
    const { geminiClient } = await import('@/services/gemini/client');
    const original = geminiClient.analyzeImage;
    geminiClient.analyzeImage = async () =>
      ({
        candidates: [
          {
            content: {
              parts: [{ text: '"esto no es un objeto válido"' }],
              role: 'model' as const,
            },
          },
        ],
      }) as never;
    try {
      // Blob mock (no se lee realmente; analyzeImageForVision es async puro).
      const blob = new Blob(['x'], { type: 'image/png' });
      await expect(analyzeImageForVision(blob)).rejects.toThrow(/La respuesta de Vision no es un objeto válido/);
    } finally {
      geminiClient.analyzeImage = original;
    }
  });

  it('validateAnalysis lanza error en español para schema incompleto', async () => {
    const { geminiClient } = await import('@/services/gemini/client');
    const original = geminiClient.analyzeImage;
    geminiClient.analyzeImage = async () =>
      ({
        candidates: [
          {
            content: {
              // subject vacío → schema incomplete.
              parts: [{ text: JSON.stringify({ subject: '', environment: '', lighting: '', composition: '', cameraPosition: '', technicalNotes: '', colorPalette: [] }) }],
              role: 'model' as const,
            },
          },
        ],
      }) as never;
    try {
      const blob = new Blob(['x'], { type: 'image/png' });
      await expect(analyzeImageForVision(blob)).rejects.toThrow(/El esquema de Vision está incompleto/);
    } finally {
      geminiClient.analyzeImage = original;
    }
  });

  it('validateAnalysis lanza error en español para colorPalette faltante', async () => {
    const { geminiClient } = await import('@/services/gemini/client');
    const original = geminiClient.analyzeImage;
    geminiClient.analyzeImage = async () =>
      ({
        candidates: [
          {
            content: {
              parts: [{
                text: JSON.stringify({
                  subject: 'sujeto válido de prueba',
                  environment: 'entorno válido de prueba',
                  lighting: 'luz cenital',
                  composition: 'regla tercios',
                  cameraPosition: 'frontal',
                  technicalNotes: 'notas técnicas válidas',
                  colorPalette: [], // vacío → error
                }),
              }],
              role: 'model' as const,
            },
          },
        ],
      }) as never;
    try {
      const blob = new Blob(['x'], { type: 'image/png' });
      await expect(analyzeImageForVision(blob)).rejects.toThrow(/la paleta de colores es obligatoria/);
    } finally {
      geminiClient.analyzeImage = original;
    }
  });

  it('model del VisualAnalysis es gemini-2.5-flash', async () => {
    const { geminiClient } = await import('@/services/gemini/client');
    const original = geminiClient.analyzeImage;
    geminiClient.analyzeImage = async () =>
      ({
        candidates: [
          {
            content: {
              parts: [{
                text: JSON.stringify({
                  subject: 'sujeto válido',
                  environment: 'entorno válido',
                  lighting: 'luz cenital',
                  composition: 'regla tercios',
                  cameraPosition: 'frontal',
                  technicalNotes: 'notas válidas',
                  colorPalette: ['#000000'],
                  textures: [],
                  dominantShapes: [],
                  depthOfField: 'medium',
                  confidence: 0.8,
                }),
              }],
              role: 'model' as const,
            },
          },
        ],
      }) as never;
    try {
      const blob = new Blob(['x'], { type: 'image/png' });
      const va = await analyzeImageForVision(blob);
      expect(va.model).toBe('gemini-2.5-flash');
    } finally {
      geminiClient.analyzeImage = original;
    }
  });

  it('GeminiProxyError expone los mensajes en español', () => {
    const err = new GeminiProxyError(500, 'La respuesta de Vision no es un objeto válido', {});
    expect(err.message).toContain('La respuesta de Vision');
  });
});