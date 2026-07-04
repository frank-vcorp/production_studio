/**
 * Contratos de request/response para el proxy Cloudflare Worker.
 * El cliente NUNCA conoce GEMINI_API_KEY; siempre pasa por /api/gemini/*.
 * Spec: ARCH-20260703-02 + SPEC-S1-FOUNDATION §1.3.
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

export interface GenerateVideoRequest {
  /** I2V: keyframe inicial como base64 */
  input_image: string;
  /** MIME del input_image */
  input_image_mimeType: string;
  /** Prompt aprobado por usuario */
  prompt: string;
  /** Modelo por defecto 'veo-3.1' */
  model?: string;
  /** Duración en segundos (3-8) */
  durationSeconds: number;
  fps?: 24 | 30;
  aspectRatio?: '9:16' | '1:1' | '4:5' | '16:9';
  /** Para generación con imagen IN + imagen OUT (futuro) */
  last_frame?: { inlineData: { mimeType: string; data: string } };
  /** Persona negativa (safety) */
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
}

export interface VideoOperation {
  name: string;
  done: boolean;
  /** Populated when done=true */
  response?: {
    videos: Array<{
      uri?: string;
      /** Base64 inline (alternativo a uri) */
      inlineData?: { mimeType: string; data: string };
      duration?: string;     // "5.0s"
    }>;
    generatedVideos?: Array<{
      video?: { uri?: string; inlineData?: { mimeType: string; data: string } };
    }>;
  };
  error?: { code: number; message: string };
  metadata?: Record<string, unknown>;
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
