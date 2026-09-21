import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { RefreshCw, AlertTriangle, Server } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpstreamStore } from "../store/upstream.store";
import { UpstreamCard } from "../components/UpstreamCard";
import type { UpstreamDiagram } from "../types";

export default function UpstreamLibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    namespaces,
    diagrams,
    loading,
    error,
    hydrate,
    fetchDiagramUrls,
  } = useUpstreamStore();

  const [search, setSearch] = useState("");
  const [expandedNamespaces, setExpandedNamespaces] = useState<Set<string>>(new Set());

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const handleRefresh = useCallback(() => {
    void hydrate();
  }, [hydrate]);

  const handleExpandNamespace = useCallback(
    async (namespace: string) => {
      setExpandedNamespaces((prev) => {
        const next = new Set(prev);
        if (next.has(namespace)) {
          next.delete(namespace);
        } else {
          next.add(namespace);
          void fetchDiagramUrls(namespace);
        }
        return next;
      });
    },
    [fetchDiagramUrls],
  );

  const handleOpenDiagram = useCallback(
    (namespace: string) => {
      navigate(`/upstream/${namespace}/view`);
    },
    [navigate],
  );

  const filteredNamespaces = useMemo(() => {
    if (!search.trim()) return namespaces;
    const q = search.toLowerCase();
    return namespaces.filter((ns) => ns.toLowerCase().includes(q));
  }, [namespaces, search]);

  const visibleDiagrams = useMemo(() => {
    const result: UpstreamDiagram[] = [];
    for (const ns of filteredNamespaces) {
      const diagram = diagrams.get(ns);
      if (diagram) result.push(diagram);
    }
    return result;
  }, [filteredNamespaces, diagrams]);

  return (
    <div className="min-h-screen pt-14">
      <Navbar />

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">{t("upstream.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("upstream.subtitle")}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            type="search"
            placeholder={t("upstream.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Content */}
        {loading && namespaces.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        ) : filteredNamespaces.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {search ? t("upstream.noResults") : t("upstream.empty")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredNamespaces.map((ns) => {
              const diagram = diagrams.get(ns);
              const isExpanded = expandedNamespaces.has(ns);
              const isLoading = isExpanded && !diagram;

              return (
                <div
                  key={ns}
                  className="rounded-lg border border-border bg-card"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenDiagram(ns)}
                    className="group flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-hover"
                  >
                    <Server className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{ns}</p>
                      <p className="text-xs text-muted-foreground">
                        {diagram
                          ? `${diagram.files.length} ${t("upstream.diagram", { count: diagram.files.length })}`
                          : t("upstream.clickToLoad")}
                      </p>
                    </div>
                    {isLoading && (
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </button>

                  {diagram && diagram.files.length > 0 && (
                    <div className="border-t border-border">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDiagram(ns);
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-primary transition-colors hover:bg-surface-hover"
                      >
                        {t("upstream.openViewer")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
