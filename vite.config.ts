/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          ffmpeg: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
          react: ['react', 'react-dom'],
          zustand: ['zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      // En desarrollo: proxy a wrangler dev (Cloudflare Worker)
      // En producción: ruta relativa al mismo Worker desplegado
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  worker: {
    format: 'es',
  },
  define: {
    // Base del proxy Cloudflare Worker.
    // HARDCODED a la URL del Worker desplegado (no usa process.env para evitar
    // que env vars de Vercel mal configuradas rompan el flujo).
    // Si necesitas cambiar el Worker, edita aquí y haz commit.
    // NUNCA expone la Gemini API key — esa se inyecta server-side en el Worker.
    'import.meta.env.VITE_PROXY_BASE': JSON.stringify(
      'https://bridge-gemini-proxy.vectoria-pstudio.workers.dev'
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      // Scope alineado con SPEC-S6 §6.1 narrativa: "≥80% en stores/services/hooks".
      // Exclusiones justificadas:
      // - services/gemini/* : clientes HTTP a Veo/Imagen → requieren red real, cubiertos por E2E.
      // - services/ffmpeg.ts : wrapper WASM pesado, no inicializable en jsdom aislado.
      // - components, types, workers : contratos declarativos / UI (cobertura por E2E).
      include: [
        'src/stores/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
        'src/data/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/__tests__/**',
        'src/stories/**',
        'src/vite-env.d.ts',
        'src/components/**',
        'src/types/**',
        'src/workers/**',
        'src/App.tsx',
        'src/services/gemini/**',
        'src/services/ffmpeg.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
// Touch: sáb 04 jul 2026 17:54:40 CST
