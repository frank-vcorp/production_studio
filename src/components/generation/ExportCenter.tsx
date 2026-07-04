import { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { MasterTab } from '@/components/generation/tabs/MasterTab';
import { PackRRSSTab } from '@/components/generation/tabs/PackRRSSTab';
import { AssetsTab } from '@/components/generation/tabs/AssetsTab';
import { ManifestTab } from '@/components/generation/tabs/ManifestTab';
import { ShareTab } from '@/components/generation/tabs/ShareTab';

/** 5 tabs del Export Center (S3 rediseño). */
type ExportTabId = 'master' | 'packRRSS' | 'assets' | 'manifest' | 'share';

interface TabSpec {
  id: ExportTabId;
  label: string;
  icon: string;
}

const TABS: TabSpec[] = [
  { id: 'master', label: 'Master', icon: 'fa-film' },
  { id: 'packRRSS', label: 'Pack RRSS', icon: 'fa-grid-2' },
  { id: 'assets', label: 'Assets', icon: 'fa-paperclip' },
  { id: 'manifest', label: 'Manifest', icon: 'fa-file-code' },
  { id: 'share', label: 'Share', icon: 'fa-share-nodes' },
];

export function ExportCenter(): JSX.Element {
  const brandKit = useProjectStore((s) => s.brandKit);
  const masterVideo = useProjectStore((s) => s.masterVideo);
  const [activeTab, setActiveTab] = useState<ExportTabId>('master');

  /** Activar tab "packRRSS" automáticamente al tener master listo (UX nice). */
  const handleTabChange = useCallback((id: ExportTabId) => {
    setActiveTab(id);
  }, []);

  const tabsDisabled = useMemo(
    () => ({
      master: false,
      packRRSS: !masterVideo,
      assets: !masterVideo,
      manifest: !masterVideo,
      share: !masterVideo,
    }),
    [masterVideo],
  );

  return (
    <section className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-cloud-arrow-down text-emerald-400" /> Export Center
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ensambla el master (9:16, &lt;30s) y distribuye en múltiples formatos.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Brand: <span className="text-sky-300 font-mono">{brandKit?.brandName ?? '—'}</span>
        </div>
      </header>

      <nav
        className="flex flex-wrap gap-1 border-b border-slate-800"
        role="tablist"
        aria-label="Secciones del Export Center"
      >
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          const isDisabled = tabsDisabled[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              data-testid={`tab-${t.id}`}
              disabled={isDisabled}
              onClick={() => handleTabChange(t.id)}
              className={`px-3 py-2 text-xs font-medium rounded-t-md transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-sky-500 text-white'
                  : isDisabled
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <i className={`fa-solid ${t.icon}`} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        data-testid={`tab-panel-${activeTab}`}
        className="flex flex-col gap-3"
      >
        {activeTab === 'master' && <MasterTab />}
        {activeTab === 'packRRSS' && <PackRRSSTab onSwitchToShare={() => setActiveTab('share')} />}
        {activeTab === 'assets' && <AssetsTab />}
        {activeTab === 'manifest' && <ManifestTab />}
        {activeTab === 'share' && <ShareTab />}
      </div>
    </section>
  );
}
