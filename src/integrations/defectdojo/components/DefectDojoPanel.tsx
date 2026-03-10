import { useEffect, useState } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import type { DDProductSearchField } from "../defectdojo.service";
import { useDefectDojoConfig } from "../hooks/useDefectDojoConfig";
import { useDefectDojoSearch } from "../hooks/useDefectDojoSearch";
import { DefectDojoConfigForm } from "./DefectDojoConfigForm";
import { DefectDojoSearchBar } from "./DefectDojoSearchBar";
import { DefectDojoResultsList } from "./DefectDojoResultsList";

export function DefectDojoPanel() {
  const { config, saveConfig, clearConfig, isConfigured } =
    useDefectDojoConfig();
  const {
    results,
    productTypes,
    loading,
    error,
    search,
    clearResults,
    loadProductTypes,
    refreshStatuses,
  } = useDefectDojoSearch(config);

  const [configOpen, setConfigOpen] = useState(!isConfigured);
  const [lastQuery, setLastQuery] = useState<{
    query: string;
    filters: { prodType?: number; searchField?: DDProductSearchField };
  } | null>(null);

  useEffect(() => {
    if (isConfigured) {
      loadProductTypes();
    }
  }, [isConfigured, loadProductTypes]);

  const handleSearch = (
    query: string,
    filters: { prodType?: number; searchField?: DDProductSearchField },
  ) => {
    setLastQuery({ query, filters });
    search(query, filters);
  };

  const handleRetry = () => {
    if (lastQuery) {
      search(lastQuery.query, lastQuery.filters);
    }
  };

  const handleSaveConfig = (cfg: Parameters<typeof saveConfig>[0]) => {
    saveConfig(cfg);
    setConfigOpen(false);
    clearResults();
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">DefectDojo</span>
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
          <DefectDojoConfigForm
            config={config}
            onSave={handleSaveConfig}
            onClear={() => {
              clearConfig();
              clearResults();
            }}
          />
        )}

        {isConfigured && (
          <>
            <DefectDojoSearchBar
              productTypes={productTypes}
              loading={loading}
              onSearch={handleSearch}
            />
            <DefectDojoResultsList
              results={results}
              loading={loading}
              error={error}
              onRetry={handleRetry}
              onRefreshStatuses={refreshStatuses}
            />
          </>
        )}

        {!isConfigured && !configOpen && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Configure a integração para importar produtos do DefectDojo.
          </p>
        )}
      </div>
    </div>
  );
}
