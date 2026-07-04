/**
 * ShareTab — S3 tarea 3.4: genera blob URL firmado + QR + embed HTML.
 */
import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/common/Button';
import { generateShareLink, formatShareLinkExpiry, type ShareLinkOutput } from '@/services/shareLink';

export function ShareTab(): JSX.Element {
  const masterVideo = useProjectStore((s) => s.masterVideo);
  const addToast = useUIStore((s) => s.addToast);
  const [share, setShare] = useState<ShareLinkOutput | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (!masterVideo) {
      addToast({ kind: 'warning', message: 'No hay master para compartir.' });
      return;
    }
    setGenerating(true);
    try {
      const out = await generateShareLink({ masterBlob: masterVideo, expiresInHours: 24 });
      setShare(out);
      addToast({ kind: 'success', message: 'Link generado (expira en 24h).' });
    } catch (e) {
      addToast({ kind: 'error', message: `Share falló: ${(e as Error).message}` });
    } finally {
      setGenerating(false);
    }
  }, [masterVideo, addToast]);

  const handleCopy = useCallback(async (text: string, label: string): Promise<void> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        addToast({ kind: 'success', message: `${label} copiado al portapapeles.` });
      }
    } catch {
      addToast({ kind: 'warning', message: 'No se pudo copiar (clipboard no disponible).' });
    }
  }, [addToast]);

  if (!masterVideo) {
    return (
      <div className="bg-slate-950 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
        Ensambla primero el master para habilitar Share.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="share-tab">
      <section className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="fa-solid fa-share-nodes text-sky-400" />
          Link compartido (expira en 24h)
        </h3>
        {!share ? (
          <Button variant="success" icon="fa-bolt" onClick={handleGenerate} loading={generating}>
            Generar link de compartir
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={share.url}
                readOnly
                className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono"
                data-testid="share-url"
              />
              <Button variant="primary" size="sm" icon="fa-copy" onClick={() => handleCopy(share.url, 'Link')}>
                Copiar
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              <i className="fa-regular fa-clock mr-1" />
              Expira en {formatShareLinkExpiry(share.expiresAt)}. El URL se revoca al cerrar la pestaña o al cumplirse el plazo.
            </p>
          </div>
        )}
      </section>

      {share && (
        <>
          <section className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-white">QR code</h3>
            <div className="flex items-center gap-4">
              <img
                src={share.qrCodeDataUrl}
                alt="QR para compartir master.mp4"
                className="w-48 h-48 bg-white rounded p-2"
                data-testid="share-qr"
              />
              <p className="text-xs text-slate-400 flex-1">
                Escaneable con cualquier teléfono. Apunta directamente al master.mp4 del blob URL.
              </p>
            </div>
            {share.qrWarning && (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2 flex items-start gap-2" role="alert">
                <i className="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5" aria-hidden="true"></i>
                <p className="text-xs text-amber-200 flex-1">{share.qrWarning}</p>
              </div>
            )}
          </section>

          <section className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Embed HTML</h3>
              <Button
                variant="secondary"
                size="sm"
                icon="fa-copy"
                onClick={() => handleCopy(share.embedHtml, 'Embed HTML')}
              >
                Copiar
              </Button>
            </div>
            <pre
              className="bg-slate-900 border border-slate-800 rounded p-3 text-[11px] text-slate-300 overflow-auto"
              data-testid="share-embed"
            >
              {share.embedHtml}
            </pre>
          </section>
        </>
      )}
    </div>
  );
}
