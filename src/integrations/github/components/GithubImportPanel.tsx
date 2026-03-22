import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Code2, ChevronDown, ChevronUp } from "lucide-react";
import type { MergeResolution } from "./GithubMergeDialog";
import { GithubMergeDialog } from "./GithubMergeDialog";
import { GithubSearchBar } from "./GithubSearchBar";
import { GithubResultsList } from "./GithubResultsList";
import { GithubConfigForm } from "./GithubConfigForm";
import { useAllServices } from "@/features/diagram";
import { useGithubImport } from "../hooks/useGithubImport";
import { useGithubConfig } from "../hooks/useGithubConfig";

export function GithubImportPanel() {
  const { t } = useTranslation();
  const { config, saveConfig, clearConfig, isConfigured } = useGithubConfig();
  const {
    client,
    results,
    selected,
    loading,
    error,
    totalCount,
    conflicts,
    nameStartsFilter,
    search,
    loadMore,
    toggleSelect,
    selectAll,
    clearSelection,
    importSelected,
    cancelConflicts,
    resolveConflicts,
  } = useGithubImport();

  const allServices = useAllServices();
  const [configOpen, setConfigOpen] = useState(!isConfigured);

  const handleResolve = (resolutions: MergeResolution[]) => {
    void resolveConflicts(resolutions);
  };

  const handleSaveConfig = async (cfg: Parameters<typeof saveConfig>[0]) => {
    await saveConfig(cfg);
    setConfigOpen(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">GitHub</span>
          {isConfigured && (
            <span className="rounded-full bg-green-500/10 border border-green-500/30 px-2 py-0.5 text-[10px] font-semibold text-green-600">
              Conectado
            </span>
          )}
        </div>
        <button
          onClick={() => setConfigOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {configOpen ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Ocultar config
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Configurar
            </>
          )}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {configOpen && (
          <GithubConfigForm
            config={config}
            onSave={handleSaveConfig}
            onClear={async () => {
              await clearConfig();
            }}
          />
        )}

        {isConfigured && (
          <>
            <GithubSearchBar loading={loading} client={client} onSearch={search} />

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <GithubResultsList
              results={results}
              selected={selected}
              totalCount={totalCount}
              loading={loading}
              allServices={allServices}
              nameStartsFilter={nameStartsFilter}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onClearSelection={clearSelection}
              onLoadMore={() => void loadMore()}
              onImport={() => void importSelected()}
            />
          </>
        )}

        {!isConfigured && !configOpen && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("github.configureIntegrationSearchImport")}
          </p>
        )}

        {conflicts && (
          <GithubMergeDialog
            conflicts={conflicts}
            onResolve={handleResolve}
            onCancel={cancelConflicts}
          />
        )}
      </div>
    </div>
  );
}
