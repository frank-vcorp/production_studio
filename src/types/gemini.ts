/**
 * Contratos de request/response para el proxy Cloudflare Worker.
 * El cliente NUNCA conoce GEMINI_API_KEY; siempre pasa por /api/gemini/*.
 * Spec: ARCH-20260703-02 + ARCH-20260704-11 (Veo 3.1) + SPEC-S1-FOUNDATION §1.3.
 */

export type ContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

export interface GenerateContentRequest {
  contents: Array<{
    role?: 'user' | 'model' | 'system';
    parts: ContentPart[];
  }>;
  systemInstruction?: { parts: ContentPart[] };
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    responseMimeType?: 'text/plain' | 'application/json';
    responseSchema?: Record<string, unknown>;
  };
  safetySettings?: Array<{
    category: string;
    threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
  }>;
}

export interface GeminiCandidate {
  content?: { parts: ContentPart[]; role: string };
  finishReason?: string;
  safetyRatings?: Array<{ category: string; probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH'; blocked?: boolean }>;
  index?: number;
}

export interface GenerateContentResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

/**
 * Veo 3.1 — predictLongRunning body shape (ARCH-20260704-11 + ARCH-20260705-02).
 * El cliente envía YA el shape Gemini y el Worker hace forward crudo.
 * Spec: https://ai.google.dev/gemini-api/docs/video#veo-3-1
 *
 * ARCH-20260705-02:
 * - `image.data` → `image.bytesBase64Encoded` (campo soportado por Gemini Developer API;
 *   "data" fue rechazado con 400 "data isn't supported by this model").
 * - `personGeneration` removido del contrato: 'dont_allow' no es soportado en
 *   Veo 3.1 público (rechazado con 400 "dont_allow for personGeneration is currently
 *   not supported"). Si en el futuro se quiere 'allow_adult', agregar de nuevo.
 */
export interface GenerateVideoRequest {
  /** Una sola instance con prompt + (opcional) imagen de referencia I2V. */
  instances: Array<{
    prompt: string;
    /** Imagen de referencia opcional (keyframe IN como base64). */
    image?: { bytesBase64Encoded: string; mimeType: string };
  }>;
  /** Parámetros del modelo. */
  parameters: {
    /** 3-8 segundos. */
    durationSeconds: number;
    aspectRatio?: '9:16' | '1:1' | '4:5' | '16:9';
    /** Negativa (no implementado en cliente v1). */
    negativePrompt?: string;
  };
}

export interface VideoOperation {
  /** `operations/{id}` retornado por predictLongRunning. */
  name: string;
  /** true cuando la operación terminó. */
  done: boolean;
  /** Populated when done=true. Forma real de Veo 3.1. */
  response?: {
    /** Wrapper estándar de la API Gemini para video. */
    generateVideoResponse?: {
      videos: Array<{
        /** URI firmada para descarga (requiere API key en query). */
        uri?: string;
        /** MIME del video, ej. 'video/mp4'. */
        mimeType?: string;
      }>;
    };
  };
  error?: { code: number; message: string };
  /** Metadata del progreso mientras done=false. */
  metadata?: {
    /** Porcentaje 0-100. */
    progressPercent?: number;
    /** Estado legible: 'PROCESSING' | 'SUCCEEDED' | 'FAILED'. */
    state?: string;
  };
}

export interface GenerateImageRequest {
  prompt: string;
  /** Imagen referencia para Imagen 3 (I2I / edición) */
  referenceImage?: { mimeType: string; data: string };
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  numberOfImages?: 1 | 2 | 4 | 8;
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
  safetyFilterLevel?: 'block_low_and_above' | 'block_medium_and_above' | 'block_only_high' | 'block_none';
}

export interface GenerateImageResponse {
  predictions: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
}

export interface TTSRequest {
  /** Texto a sintetizar */
  text: string;
  /** 'Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede' (voces multi) */
  voiceName?: string;
  /** Idioma */
  languageCode?: string;
  /** Modelo a usar */
  model?: string;
  /** Velocidad 0.5-2.0 */
  speakingRate?: number;
  /** Tono +/-20 semitonos */
  pitch?: number;
}

export interface TTSResponse {
  audioContent: string;   // base64 PCM/WAV
  mimeType: string;
  durationSeconds?: number;
}
