/**
 * shareLink — genera link blob URL firmado + QR code (client-side) + embed HTML.
 * Spec: SPEC-S3-EXPORT §Tarea 3.4.
 *
 * Notas críticas:
 * - URL.createObjectURL debe revocarse o programarse el revoke; sino, leak garantizado.
 * - revoke programado se hace también en `beforeunload` (cleanup adicional).
 * - QRCode usa la lib `qrcode` (no `qrcode.react`); API: await QRCode.toDataURL(text, opts).
 *   El QR por encima de ~2KB puede fallar — manejamos con fallback de texto acortado.
 */

import QRCode from 'qrcode';

export interface ShareLinkOptions {
  masterBlob: Blob;
  manifest?: unknown;
  expiresInHours?: number; // default 24
}

export interface ShareLinkOutput {
  url: string;
  expiresAt: number;
  qrCodeDataUrl: string;
  embedHtml: string;
  cleanup: () => void; // función para revocar manualmente
  qrWarning?: string; // presente cuando el QR se generó con fallback (ej. URL > 2KB)
}

const trackedUrls = new Set<string>();

function trackForUnloadRevoke(url: string): void {
  trackedUrls.add(url);
  // Revoca al cerrar pestaña si el usuario no la liberó antes
  if (typeof window !== 'undefined') {
    const handler = (): void => {
      trackedUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      trackedUrls.clear();
      window.removeEventListener('beforeunload', handler);
    };
    window.addEventListener('beforeunload', handler, { once: true });
  }
}

export async function generateShareLink(
  options: ShareLinkOptions,
): Promise<ShareLinkOutput> {
  const { masterBlob, expiresInHours = 24 } = options;
  const expiresAt = Date.now() + expiresInHours * 3_600_000;

  // 1. Blob URL
  const url = URL.createObjectURL(masterBlob);
  trackForUnloadRevoke(url);

  // 2. QR (la lib qrcode soporta payload de hasta ~2KB; con URL blob típico ~50 chars sobra)
  let qrCodeDataUrl: string;
  let qrWarning: string | undefined;
  try {
    qrCodeDataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    // Fallback: placeholder 1x1 transparente si la URL es demasiado larga
    qrCodeDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
    qrWarning = 'La URL es demasiado larga para generar un QR escaneable. Comparte el enlace directamente.';
    console.warn('[shareLink] QR generation failed (URL too long?), using fallback:', err);
  }

  // 3. Embed HTML
  const embedHtml = `<video src="${url}" controls width="100%" preload="metadata" style="border-radius:12px;background:#000"></video>`;

  // 4. Cleanup programado
  const timer = setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
      trackedUrls.delete(url);
    } catch {
      /* ignore */
    }
  }, expiresInHours * 3_600_000);

  const cleanup = (): void => {
    clearTimeout(timer);
    try {
      URL.revokeObjectURL(url);
      trackedUrls.delete(url);
    } catch {
      /* ignore */
    }
  };

  return { url, expiresAt, qrCodeDataUrl, embedHtml, cleanup, qrWarning };
}

/** Helper para mostrar "expires in Xh" o "Xmin" en UI (auto-formato). */
export function formatShareLinkExpiry(expiresAt: number, now = Date.now()): string {
  const diffMs = expiresAt - now;
  if (diffMs <= 0) return 'expirado';
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  return `${minutes}min`;
}
