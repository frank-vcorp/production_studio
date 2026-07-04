/**
 * ManifestTab — vista legible + descarga del manifest.json del proyecto.
 */
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/common/Button';
import { downloadJSON } from '@/utils/download';

export function ManifestTab(): JSX.Element {
  const manifest = useProjectStore((s) => s.manifest);
  const brief = useProjectStore((s) => s.brief);

  if (!manifest) {
    return (
      <div className="bg-slate-950 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
        El manifest se genera al ensamblar el master.
      </div>
    );
  }

  const handleDownload = (): void => {
    downloadJSON(
      { ...manifest, briefSummary: brief?.business.name },
      `bridge-manifest-${Date.now()}.json`,
    );
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="fa-solid fa-file-code text-emerald-400" />
          manifest.json
        </h3>
        <Button variant="primary" size="sm" icon="fa-download" onClick={handleDownload}>
          Descargar
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        <span>Timeline: <strong className="text-white">{manifest.timelineOrder.length} nodos</strong></span>
        <span>Clips: <strong className="text-white">{manifest.clips.length}</strong></span>
        <span>Versión: <strong className="text-white">{manifest.appVersion}</strong></span>
        <span>Generado: <strong className="text-white">{new Date(manifest.generatedAt).toLocaleString()}</strong></span>
      </div>
      <pre
        className="bg-slate-900 border border-slate-800 rounded p-3 text-[11px] text-slate-300 overflow-auto max-h-96"
        data-testid="manifest-json"
      >
        {JSON.stringify({ ...manifest, briefSummary: brief?.business.name }, null, 2)}
      </pre>
    </div>
  );
}
