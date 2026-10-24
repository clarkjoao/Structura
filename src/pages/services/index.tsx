import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BulkDeleteConfirmDialog } from "@/components/BulkDeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { useModifierKey } from "@/hooks/useModifierKey";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import {
  useAllServices,
  useDiagrams,
  useServiceActions,
  useDiagramActions,
} from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import { SERVICE_ROLES, effectiveServiceRole } from "@/features/diagram";
import { useTranslation } from "react-i18next";
import { PluginPanelSlot } from "@/features/plugins/components/PluginPanelSlot";
import { AddServiceDialog } from "./AddServiceDialog";
import { DetailPanel } from "./DetailPanel";
import { ServiceCard } from "./ServiceCard";
import { countByRole, groupServices } from "./groupServices";
import { groupLabel, groupHint } from "./serviceLabels";
import { getServiceUsage } from "./serviceUsage";
import type { GroupBy, RoleFilter } from "./types";

export default function ServicesPage() {
  const { t } = useTranslation();
  const services = useAllServices();
  const diagrams = useDiagrams();
  const { addService, updateService, removeService } = useServiceActions();
  const { openDiagram } = useDiagramActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("role");
  const searchRef = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
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

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.owner ?? "").toLowerCase().includes(q) ||
        (effectiveServiceRole(s) ?? "").toLowerCase().includes(q) ||
        s.technology.some((t) => t.toLowerCase().includes(q)) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [services, search]);

  const roleCounts = useMemo(() => countByRole(searched), [searched]);

  const filtered = useMemo(
    () =>
      roleFilter === "all"
        ? searched
        : searched.filter((s) => (effectiveServiceRole(s) ?? "none") === roleFilter),
    [searched, roleFilter],
  );

  const groups = useMemo(() => groupServices(filtered, groupBy), [filtered, groupBy]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if (event.key !== "/" || typing || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    setRoleFilter("all");
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
    setAddOpen(false);
    setSelectedId(created.id);
  };

  const roleChips: { value: RoleFilter; label: string }[] = [
    { value: "all", label: t("services.filterAll") },
    ...SERVICE_ROLES.map((role) => ({ value: role, label: t(`services.role.${role}`) })),
    { value: "none", label: t("services.role.none") },
  ];

  const groupOptions: { value: GroupBy; label: string }[] = [
    { value: "role", label: t("services.groupByRole") },
    { value: "technology", label: t("services.groupByTechnology") },
    { value: "source", label: t("services.groupBySource") },
  ];

  return (
    <div className="min-h-screen pt-14">
      <Navbar />
      <div className="px-6 py-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">
              {t("services.title")}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                · {t("services.repositoryCount", { count: services.length })}
              </span>
            </h1>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("services.addService")}
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("services.searchPlaceholder")}
              className="w-full rounded-xl border border-border bg-card py-3.5 pl-12 pr-12 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {search ? (
              <button
                onClick={() => setSearch("")}
                aria-label={t("services.clearSearch")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 text-xs text-muted-foreground">
                /
              </kbd>
            )}
          </div>

          <div className="mb-8 flex flex-wrap items-center gap-2">
            {roleChips.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setRoleFilter(chip.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  roleFilter === chip.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {chip.label} <span className="font-mono opacity-70">{roleCounts[chip.value]}</span>
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {t("services.groupBy")}
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {groupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <AddServiceDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            services={services}
            onCreate={handleCreate}
            onOpenExisting={(id) => {
              setAddOpen(false);
              setSearch("");
              setRoleFilter("all");
              setSelectedId(id);
            }}
          />

          <div className="mb-6 empty:hidden">
            <PluginPanelSlot slot="services-import" serviceId={selectedId} />
          </div>

          <div
            className={
              selectedSvc ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]" : undefined
            }
          >
            <div className="space-y-8">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {services.length === 0
                      ? t("services.emptyNoServices")
                      : t("services.emptyFiltered")}
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <section key={group.key}>
                    <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-foreground">
                      {groupLabel(t, groupBy, group.key)}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {group.services.length}
                      </span>
                      {groupHint(t, groupBy, group.key) && (
                        <span className="text-xs font-normal text-muted-foreground">
                          · {groupHint(t, groupBy, group.key)}
                        </span>
                      )}
                    </h2>
                    <div
                      className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${selectedSvc ? "" : "xl:grid-cols-3"}`}
                    >
                      {group.services.map((svc) => (
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
                  </section>
                ))
              )}
            </div>

            {selectedSvc && (
              <div className="xl:sticky xl:top-24">
                <DetailPanel
                  key={selectedSvc.id}
                  svc={selectedSvc}
                  diagrams={diagrams}
                  onNavigateToDiagram={handleNavigateToDiagram}
                  updateService={updateService}
                  removeService={removeService}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            )}
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
