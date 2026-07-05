# Pendientes v1.1 — Post-Deploy

> Notas acumuladas durante testing en Vercel production. Para Sprint v1.1 (futuro).

## 🟡 Sugerencias del usuario (diferidas a v1.1)

| # | Sugerencia | Origen | Notas de implementación |
|---|---|---|---|
| **1** | **Botón "Mejorar prompt con Gemini"** en `PromptApprovalGate` | Usuario, testing Vercel | Similar al "improve prompt" de Kilo Code. Usa Gemini para reescribir el prompt generado en algo más cinematográfico. Casos: prompt genérico → prompt con mejor cámara/lighting/ángulo. Ubicación: dentro del `PromptApprovalGate`, junto a "Restaurar Original". |
| **2** | Permitir **múltiples imágenes en Generales** (galería) | Usuario, testing Vercel | Usuario pidió "poder subir varias" imágenes del lugar. Hoy solo 1 slot. Refactor: agregar array de blobs en keyframes tipo `gallery_1`, `gallery_2`, etc. |

## 🐛 Bugs / Deuda Técnica detectada

| # | Issue | Estado actual | Acción sugerida |
|---|---|---|---|
| **1** | **`interes_in` duplicado** en STORYBOARD_STRUCTURE (aparece en Generales Y AIDA · Interés) | Bug menor, no rompe UI pero confuso semánticamente | Renombrar a `gallery_space` o unificar en una sola categoría |
| **2** | **Header muestra "S5"** en vez de versión del producto | Cosmético, bug menor | Reemplazar por `v1.0.0` o leer de `package.json` |
| **3** | **Favicon.svg falta** (404 en consola) | Cosmético, no afecta funcionalidad | Agregar `public/favicon.svg` con logo simple |
| **4** | **`jobQueue.ts` importa dinámico + estático** warning de Vite | Cosmético | Convertir todos los imports a dinámicos (esencial o no-imports) |
| **5** | **Coverage de `projectStore.ts` 60%** | Por debajo del promedio 85% | Agregar más tests de integración |
| **6** | **Coverage de `idbStorage.ts` 70%** | Por debajo del promedio 85% | Agregar más tests de edge cases |

## 🚀 Mejoras sugeridas por S5+S6 GEMINI audits

| # | Mejora | Origen | Notas |
|---|---|---|---|
| **1** | `useModalKeyboardShortcuts` extraer a hook centralizado | GEMINI S5 #1 | Centraliza Esc handler en modales |
| **2** | Internacionalización i18n (inglés/español) | Roadmap v1.1+ | react-i18next |
| **3** | Multi-provider abstraction (Runway, Pika, ElevenLabs) | Roadmap v1.2 | Interfaces ya preparadas |
| **4** | PWA / Mobile app | Roadmap v1.2+ | Service Worker básico ya está |
| **5** | Telemetría dashboards | Roadmap v2.0 | Para usage analytics |

## 📋 Comandos útiles para v1.1

```bash
# Verifico que todo siga verde antes de empezar v1.1
cd /mnt/Datos/Proyectos\ 2.0/production_studio
pnpm typecheck
pnpm test --run
pnpm lint
pnpm build
pnpm test:e2e

# Verificar que Wrangler sigue deployado
cd worker && ./node_modules/.bin/wrangler tail
```
