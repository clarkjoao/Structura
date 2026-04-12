import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Layers,
  Network,
  FolderOpen,
  LayoutGrid,
  List,
  ArrowUpDown,
  Search,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import {
  useAllDiagrams,
  useFolders,
  useDiagramActions,
  removeRecentRef,
} from "@/features/diagram";
import { deletePreview } from "@/lib/diagram-preview/previewCache";
import type { Level, Diagram } from "@/features/diagram";
import { ImportModal } from "@/pages/ImportModal";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BulkDeleteConfirmDialog } from "@/components/BulkDeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { useModifierKey } from "@/hooks/useModifierKey";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { FolderTree } from "@/pages/FolderTree";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AddDiagramDialog } from "@/pages/dashboard/AddDiagramDialog";
import { DiagramGrid } from "@/pages/dashboard/DiagramGrid";
import { DiagramList } from "@/pages/dashboard/DiagramList";
import type { GlobalSearchHit, SortKey, ViewMode } from "@/pages/dashboard/dashboard.types";
import { buildBreadcrumbPath } from "@/pages/dashboard/dashboard.utils";

export default function DashboardPage() {
  const { t } = useTranslation();
  const levelLabels = useMemo(
    () => ({
      context: t("dashboard.levelContextShort"),
      container: t("dashboard.levelContainerShort"),
      component: t("dashboard.levelComponentShort"),
      deployment: t("dashboard.levelDeploymentShort"),
    }),
    [t],
  );
  const diagrams = useAllDiagrams();
  const folders = useFolders();
  const {
    addDiagram,
    openDiagram,
    deleteDiagram,
    moveDiagram,
    deleteFolder,
  } = useDiagramActions();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFolderId = searchParams.get("f");

  const setSelectedFolderId = useCallback(
    (folderId: string | null) => {
      setSearchParams(
        folderId ? { f: folderId } : {},
        { replace: true }
      );
    },
    [setSearchParams]
  );

  
  useEffect(() => {
    const f = searchParams.get("f");
    if (f && !folders[f]) {
      setSearchParams({}, { replace: true });
    }
  }, [folders, searchParams, setSearchParams]);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<
    string | null | undefined
  >(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [triggerAddFolder, setTriggerAddFolder] = useState(0);
  const [activeDomainFilter, setActiveDomainFilter] = useState<string | null>(
    null,
  );
  const [globalSearch, setGlobalSearch] = useState("");
  const folderTreeRef = useRef<HTMLDivElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isModifierActive = useModifierKey();
  const {
    selectedIds,
    toggleSelect,
    clearSelection,
    isSelected: isBulkIdSelected,
  } = useMultiSelect();

  const diagramIdSet = useMemo(
    () => new Set(diagrams.map((diagram) => diagram.id)),
    [diagrams],
  );

  const dashboardBulkCounts = useMemo(() => {
    let diagramsCount = 0;
    let foldersCount = 0;
    for (const id of selectedIds) {
      if (diagramIdSet.has(id)) {
        diagramsCount += 1;
      } else if (folders[id]) {
        foldersCount += 1;
      }
    }
    return {
      diagrams: diagramsCount,
      folders: foldersCount,
      services: 0,
    };
  }, [diagramIdSet, folders, selectedIds]);

  const breadcrumbPath = useMemo(
    () => buildBreadcrumbPath(folders, selectedFolderId),
    [folders, selectedFolderId],
  );

  const { childFolders, folderDiagrams } = useMemo(() => {
    const allFolders = Object.values(folders);
    const childFolders = allFolders.filter(
      (f) => (f.parentId ?? null) === selectedFolderId,
    );
    const folderDiagrams = diagrams.filter(
      (d) => (d.folderId ?? null) === selectedFolderId,
    );
    return { childFolders, folderDiagrams };
  }, [folders, diagrams, selectedFolderId]);

  const globalSearchResults = useMemo((): GlobalSearchHit[] | null => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return null;
    return diagrams
      .flatMap((d) =>
        Object.values(d.snapshot.components).map((c) => ({
          ...c,
          diagramId: d.id,
          diagramName: d.name,
        })),
      )
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [globalSearch, diagrams]);

  const allDomains = useMemo(
    () =>
      [
        ...new Set(
          diagrams
            .map((d) => d.domain?.trim())
            .filter((domain): domain is string => Boolean(domain)),
        ),
      ],
    [diagrams],
  );

  const sorted = useMemo(() => {
    const arr = [...folderDiagrams];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "domain")
        cmp = (a.domain ?? "").localeCompare(b.domain ?? "");
      else if (sortKey === "level") cmp = a.level.localeCompare(b.level);
      else cmp = a.updatedAt.localeCompare(b.updatedAt);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [folderDiagrams, sortKey, sortAsc]);

  const domainFiltered = useMemo(() => {
    if (!activeDomainFilter) return sorted;
    return sorted.filter((d) => d.domain === activeDomainFilter);
  }, [sorted, activeDomainFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const handleOpen = useCallback(
    (diagram: Diagram) => {
      openDiagram(diagram.id);
      navigate(`/model/${diagram.id}`);
    },
    [navigate, openDiagram],
  );

  const isModifierClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) =>
      event.ctrlKey || event.metaKey || isModifierActive,
    [isModifierActive],
  );

  const handleDiagramCardSelect = useCallback(
    (diagram: Diagram, event: React.MouseEvent<HTMLElement>) => {
      if (isModifierClick(event)) {
        event.preventDefault();
        toggleSelect(diagram.id, true);
        return;
      }
      handleOpen(diagram);
    },
    [handleOpen, isModifierClick, toggleSelect],
  );

  const handleFolderCardClick = useCallback(
    (folderId: string, event: React.MouseEvent<HTMLElement>) => {
      if (isModifierClick(event)) {
        event.preventDefault();
        toggleSelect(folderId, true);
        return;
      }
      setSelectedFolderId(folderId);
    },
    [isModifierClick, setSelectedFolderId, toggleSelect],
  );

  const handleDashboardBulkDeleteConfirm = useCallback(() => {
    const diagramIds = [...selectedIds].filter((id) => diagramIdSet.has(id));
    const folderIds = [...selectedIds].filter((id) => folders[id]);
    for (const id of diagramIds) {
      deletePreview(id);
      deleteDiagram(id);
      removeRecentRef(id);
    }
    for (const id of folderIds) {
      deleteFolder(id);
    }
    clearSelection();
    setBulkDeleteOpen(false);
  }, [
    clearSelection,
    deleteDiagram,
    deleteFolder,
    diagramIdSet,
    folders,
    selectedIds,
  ]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const pendingDeleteDiagram = pendingDeleteId
    ? diagrams.find((diagram) => diagram.id === pendingDeleteId) ?? null
    : null;

  const handleAddDiagram = useCallback(
    (name: string, level: Level, domain?: string, description?: string) => {
      const d = addDiagram(name, level, domain, selectedFolderId, description);
      openDiagram(d.id);
      navigate(`/model/${d.id}`);
      setShowAdd(false);
    },
    [addDiagram, openDiagram, navigate, selectedFolderId],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, diagramId: string) => {
      e.dataTransfer.setData("application/x-structura-diagram-id", diagramId);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOverFolder = useCallback((folderId: string | null) => {
    setDropTargetFolderId(folderId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetFolderId(undefined);
  }, []);

  const currentFolderName = selectedFolderId
    ? folders[selectedFolderId]?.name ?? t("common.emDash")
    : t("dashboard.allDiagrams");

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="flex h-[calc(100vh-4rem)]">
        <div
          ref={folderTreeRef}
          className="w-56 shrink-0 overflow-hidden border-r border-border"
        >
          <FolderTree
            folders={folders}
            diagrams={diagrams}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            dropTargetFolderId={dropTargetFolderId}
            onDragOverFolder={handleDragOverFolder}
            onDragLeave={handleDragLeave}
            onDropOnFolder={(folderId, diagramId) => {
              moveDiagram(diagramId, folderId);
              setDropTargetFolderId(undefined);
            }}
            triggerAddFolderAtRoot={triggerAddFolder}
          />
        </div>

        <div className="flex flex-1 flex-col min-w-0 bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  {selectedFolderId ? (
                    <BreadcrumbLink
                      asChild
                      onClick={() => setSelectedFolderId(null)}
                      className="cursor-pointer"
                    >
                      <button type="button" className="text-[13px]">
                        {t("common.workspace")}
                      </button>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="text-[13px]">
                      {t("common.workspace")}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {breadcrumbPath.map((folder, i) => {
                  const isLast = i === breadcrumbPath.length - 1;
                  return (
                    <React.Fragment key={folder.id}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="text-[13px]">
                          {folder.name}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          asChild
                          onClick={() => setSelectedFolderId(folder.id)}
                          className="cursor-pointer"
                        >
                          <button type="button" className="text-[13px]">
                            {folder.name}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  placeholder={t("dashboard.searchComponentPlaceholder")}
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="h-7 w-48 rounded-md border border-border bg-secondary/50 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex items-center rounded-md border border-border bg-secondary/50 p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "rounded p-1 transition-colors",
                    viewMode === "grid"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "rounded p-1 transition-colors",
                    viewMode === "list"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    {t("common.sort")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSort("name")}>
                    {t("common.name")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("updatedAt")}>
                    {t("common.lastEdited")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("level")}>
                    {t("common.c4Level")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("domain")}>
                    {t("common.domain")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {currentFolderName}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("dashboard.diagramCount", {
                    count: folderDiagrams.length,
                    diagrams: t(
                      folderDiagrams.length === 1 ? "common.diagram_one" : "common.diagram_other",
                    ),
                    folders:
                      childFolders.length > 0
                        ? t("dashboard.foldersSuffix", {
                            count: childFolders.length,
                            folders: t(
                              childFolders.length === 1 ? "common.folder_one" : "common.folder_other",
                            ),
                          })
                        : "",
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setImportModalOpen(true)}
                >
                  {t("import.button")}
                </Button>
                <Button
                  onClick={() => setShowAdd(true)}
                  size="sm"
                  className="gap-1.5 h-8"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("dashboard.newDiagram")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTriggerAddFolder((t) => t + 1)}
                  className="gap-1.5 h-8"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("dashboard.newFolder")}
                </Button>
              </div>
            </div>

            {globalSearchResults !== null && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  {t("dashboard.resultsFor", {
                    count: globalSearchResults.length,
                    results: t(
                      globalSearchResults.length === 1 ? "common.result_one" : "common.result_other",
                    ),
                    query: globalSearch,
                  })}
                </p>
                {globalSearchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboard.noComponentsFound")}</p>
                ) : (
                  <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
                    {globalSearchResults.map((c) => (
                      <button
                        key={`${c.diagramId}-${c.id}`}
                        type="button"
                        onClick={() => { openDiagram(c.diagramId); navigate(`/model/${c.diagramId}`); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                          {c.description && <p className="text-[11px] text-muted-foreground truncate">{c.description}</p>}
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground bg-secondary rounded px-2 py-0.5">{c.diagramName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {globalSearchResults === null && allDomains.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveDomainFilter(null)}
                  className={cn(
                    "text-[10px] rounded-full px-2.5 py-0.5 font-medium transition-colors border",
                    activeDomainFilter === null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80",
                  )}
                >
                  {t("common.all")}
                </button>
                {allDomains.map((domain) => (
                  <button
                    key={domain}
                    onClick={() =>
                      setActiveDomainFilter(
                        activeDomainFilter === domain ? null : domain,
                      )
                    }
                    className={cn(
                      "text-[10px] rounded-full px-2.5 py-0.5 font-medium transition-colors border",
                      activeDomainFilter === domain
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80",
                    )}
                  >
                    {domain}
                  </button>
                ))}
              </div>
            )}

            {globalSearchResults === null && childFolders.length > 0 && (
              <div className="mb-5">
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {childFolders.map((folder) => {
                    const subCount = Object.values(folders).filter(
                      (f) => f.parentId === folder.id,
                    ).length;
                    const diagCount = diagrams.filter(
                      (d) => d.folderId === folder.id,
                    ).length;
                    const total = subCount + diagCount;
                    return (
                      <motion.div
                        key={folder.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(event) => handleFolderCardClick(folder.id, event)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40 hover:border-border/80",
                          isBulkIdSelected(folder.id) && "ring-2 ring-primary",
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                          <FolderOpen className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate text-foreground">
                            {folder.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {total}{" "}
                            {t(total === 1 ? "common.item_one" : "common.item_other")}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {globalSearchResults === null && (viewMode === "grid" ? (
              <DiagramGrid
                diagrams={domainFiltered}
                onSelect={handleDiagramCardSelect}
                isDiagramSelected={isBulkIdSelected}
                onDragStart={handleDragStart}
                levelLabels={levelLabels}
              />
            ) : (
              <DiagramList
                diagrams={domainFiltered}
                onOpen={handleOpen}
                onDelete={handleDelete}
                onDragStart={handleDragStart}
                levelLabels={levelLabels}
              />
            ))}

            {globalSearchResults === null &&
              domainFiltered.length === 0 &&
              childFolders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                  <Network className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("dashboard.noDiagramsYet")}
                </p>
                <p className="text-xs text-muted-foreground/60 mb-4">
                  {t("dashboard.createFirst")}
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowAdd(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("dashboard.createDiagram")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddDiagramDialog
          onClose={() => setShowAdd(false)}
          onAdd={handleAddDiagram}
        />
      )}

      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        targetFolderId={selectedFolderId}
      />

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            key="dashboard-selection-bar"
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
          counts={dashboardBulkCounts}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={handleDashboardBulkDeleteConfirm}
        />
      )}

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("diagram.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteDiagram
                ? t("diagram.deleteConfirmDescription", {
                    name: pendingDeleteDiagram.name,
                    nodeCount: Object.keys(pendingDeleteDiagram.snapshot.components).length,
                    flowCount: Object.keys(pendingDeleteDiagram.snapshot.flows).length,
                  })
                : t("diagram.deleteConfirmFallback")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDeleteId) return;
                deletePreview(pendingDeleteId);
                deleteDiagram(pendingDeleteId);
                removeRecentRef(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
