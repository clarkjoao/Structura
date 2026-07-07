import { useCallback, useEffect, useMemo, lazy, Suspense, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BulkDeleteConfirmDialog } from "@/components/BulkDeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { useModifierKey } from "@/hooks/useModifierKey";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { GithubImportPanel } from "@/features/integrations/github/components/GithubImportPanel";
import { normalizeSources } from "@/features/integrations/merge-utils";
import {
  useAllServices,
  useDiagrams,
  useCatalogActions,
  useDiagramActions,
} from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource, ImportPanel } from "@/features/diagram";
import { useTranslation } from "react-i18next";
import { PluginPanelSlot } from "@/features/plugins/components/PluginPanelSlot";
import { DetailPanel } from "./DetailPanel";
import { ManualCreateForm } from "./ManualCreateForm";
import { ServiceCard } from "./ServiceCard";
import { getServiceUsage } from "./serviceUsage";
import type { SourceFilter } from "./types";

const DefectDojoPanel = lazy(() =>
  import("@/features/integrations/defectdojo").then((m) => ({
    default: m.DefectDojoPanel,
  })),
);

export default function ServiceCatalogPage() {
  const { t } = useTranslation();
  const services = useAllServices();
  const diagrams = useDiagrams();
  const { addService, updateService, removeService } = useCatalogActions();
  const { openDiagram } = useDiagramActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [importPanel, setImportPanel] = useState<ImportPanel | null>(null);
  const showEnableGithub = import.meta.env.VITE_ENABLE_GITHUB_IMPORT === "true";
  const showEnableDefectDojo = import.meta.env.VITE_ENABLE_DEFECTDOJO === "true";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedFromQuery = searchParams.get("serviceId");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const isModifierActive = useModifierKey();
  const {
    selectedIds,
    toggleSelect,
    clearSelection,
    isSelected: isBulkIdSelected,
  } = useMultiSelect();

  const registryBulkCounts = useMemo(() => {
    let servicesCount = 0;
    for (const id of selectedIds) {
      if (services.some((service) => service.id === id)) {
        servicesCount += 1;
      }
    }
    return { diagrams: 0, folders: 0, services: servicesCount };
  }, [selectedIds, services]);

  const filtered = useMemo(() => {
    let result = services;
    if (sourceFilter !== "all") {
      result = result.filter((service) =>
        normalizeSources(service).some((source) => source.type === sourceFilter),
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.owner ?? "").toLowerCase().includes(q) ||
          s.technology.some((t) => t.toLowerCase().includes(q)) ||
          (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [services, search, sourceFilter]);

  const selectedSvc = useMemo(
    () => (selectedId ? services.find((s) => s.id === selectedId) : undefined),
    [selectedId, services],
  );

  useEffect(() => {
    if (selectedId && !services.find((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, services]);

  useEffect(() => {
    if (selectedId && !filtered.find((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedFromQuery) return;

    const target = services.find((service) => service.id === selectedFromQuery);
    if (!target) return;

    setSearch("");
    setSourceFilter("all");
    setSelectedId(target.id);

    requestAnimationFrame(() => {
      document
        .getElementById(`registry-service-${target.id}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [selectedFromQuery, services]);

  const usageMap = useMemo(() => {
    const map: Record<string, { diagramId: string; diagramName: string; nodeCount: number }[]> = {};
    for (const svc of services) {
      map[svc.id] = getServiceUsage(svc.id, diagrams);
    }
    return map;
  }, [services, diagrams]);

  const handleNavigateToDiagram = useCallback(
    (diagramId: string, serviceId: string) => {
      openDiagram(diagramId);
      navigate(`/model/${diagramId}?serviceId=${encodeURIComponent(serviceId)}`);
    },
    [openDiagram, navigate],
  );

  const isModifierClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => event.ctrlKey || event.metaKey || isModifierActive,
    [isModifierActive],
  );

  const handleServiceCardClick = useCallback(
    (svc: ServiceDefinition, event: React.MouseEvent<HTMLButtonElement>) => {
      if (isModifierClick(event)) {
        event.preventDefault();
        toggleSelect(svc.id, true);
        return;
      }
      setSelectedId((current) => (current === svc.id ? null : svc.id));
    },
    [isModifierClick, toggleSelect],
  );

  const handleRegistryBulkDeleteConfirm = useCallback(() => {
    for (const id of selectedIds) {
      removeService(id);
    }
    clearSelection();
    setBulkDeleteOpen(false);
  }, [clearSelection, removeService, selectedIds]);

  const handleCreate = (svc: Omit<ServiceDefinition, "id">) => {
    const created = addService(svc);
    setImportPanel(null);
    setSelectedId(created.id);
  };

  const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
    { value: "all", label: t("registry.filterAll") },
    { value: ServiceSource.Manual, label: t("registry.filterManual") },
    { value: ServiceSource.Github, label: t("registry.filterGithub") },
    { value: ServiceSource.Defectdojo, label: t("registry.filterDefectdojo") },
  ];

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="px-6 py-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("registry.title")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("registry.subtitle")}</p>
            </div>
            <button
              onClick={() => setImportPanel((current) => (current ? null : ImportPanel.Manual))}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("registry.addService")}
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("registry.searchPlaceholder")}
              className="w-full rounded-lg border border-border bg-card pl-10 pr-10 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            {SOURCE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setSourceFilter(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  sourceFilter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              · {filtered.length} {t("common.service", { count: filtered.length })}
            </span>
          </div>

          {importPanel && (
            <div className="mb-6 rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-1 rounded-lg bg-secondary p-1">
                  <button
                    onClick={() => setImportPanel(ImportPanel.Manual)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      importPanel === ImportPanel.Manual
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("registry.importManual")}
                  </button>
                  {showEnableGithub && (
                    <button
                      onClick={() => setImportPanel(ImportPanel.Github)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        importPanel === ImportPanel.Github
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t("registry.importGithub")}
                    </button>
                  )}
                  {showEnableDefectDojo && (
                    <button
                      onClick={() => setImportPanel(ImportPanel.Defectdojo)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        importPanel === ImportPanel.Defectdojo
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t("registry.importDefectDojo")}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setImportPanel(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-secondary" />}>
                {importPanel === ImportPanel.Manual && (
                  <ManualCreateForm onCancel={() => setImportPanel(null)} onCreate={handleCreate} />
                )}
                {importPanel === ImportPanel.Defectdojo && <DefectDojoPanel />}
                {importPanel === ImportPanel.Github && <GithubImportPanel />}
              </Suspense>
            </div>
          )}

          <div className="mb-6 empty:hidden">
            <PluginPanelSlot slot="service-registry-import" serviceId={selectedId} />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {services.length === 0
                      ? t("registry.emptyNoServices")
                      : t("registry.emptyFiltered")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {filtered.map((svc) => (
                    <div id={`registry-service-${svc.id}`} key={svc.id}>
                      <ServiceCard
                        svc={svc}
                        isSelected={selectedId === svc.id}
                        isBulkSelected={isBulkIdSelected(svc.id)}
                        onClick={(event) => handleServiceCardClick(svc, event)}
                        usage={usageMap[svc.id] ?? []}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="xl:sticky xl:top-24">
              {selectedSvc ? (
                <DetailPanel
                  key={selectedSvc.id}
                  svc={selectedSvc}
                  diagrams={diagrams}
                  onNavigateToDiagram={handleNavigateToDiagram}
                  updateService={updateService}
                  removeService={removeService}
                  onClose={() => setSelectedId(null)}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-8 text-sm text-muted-foreground">
                  {t("registry.selectForDetails")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            key="registry-selection-bar"
            role="toolbar"
            aria-label={t("bulkDelete.selectionBar", {
              count: selectedIds.size,
            })}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed bottom-6 left-1/2 z-50 flex w-[min(100%-1.5rem,36rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-2xl"
          >
            <p className="text-xs font-medium text-foreground truncate">
              {t("bulkDelete.selectionBar", { count: selectedIds.size })}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
                {t("bulkDelete.clearSelection")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
              >
                {t("bulkDelete.deleteSelected")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {bulkDeleteOpen && (
        <BulkDeleteConfirmDialog
          counts={registryBulkCounts}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={handleRegistryBulkDeleteConfirm}
        />
      )}
    </div>
  );
}
