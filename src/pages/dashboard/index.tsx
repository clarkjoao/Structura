import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Network, FolderOpen, Upload, Clock, Star, Download } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAllDiagrams, useFolders, useDiagramActions, removeRecentRef } from "@/features/diagram";
import { deletePreview } from "@/lib/diagram-preview/previewCache";
import type { Level, Diagram } from "@/features/diagram";
import { useRecentDiagrams } from "@/features/canvas/navigation/useRecentDiagrams";
import { ImportModal } from "@/pages/ImportModal";
import { WorkspaceExportModal } from "@/pages/workspace/WorkspaceExportModal";
import { useServices } from "@/features/diagram";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { useSelectAllShortcut } from "@/hooks/useSelectAllShortcut";
import { FolderTree } from "@/components/folders/FolderTree";
import { ConnectedFolderCard } from "@/pages/ConnectedFolderCard";
import { DIAGRAM_DRAG_MIME } from "@/components/folders/dragTypes";
import { cn } from "@/lib/utils";
import { AddDiagramDialog } from "@/pages/dashboard/AddDiagramDialog";
import { DiagramGrid } from "@/pages/dashboard/DiagramGrid";
import { DiagramList } from "@/pages/dashboard/DiagramList";
import { LibraryFilterToolbar } from "@/components/filters/LibraryFilterToolbar";
import {
  readFavoriteIds,
  toggleFavoriteDiagram,
  writeFavoriteIds,
} from "@/pages/dashboard/favoriteDiagrams";
import { RenameDiagramModal } from "@/pages/dashboard/RenameDiagramModal";
import { MoveDiagramDialog } from "@/pages/dashboard/components/diagram-card/MoveDiagramDialog";
import type {
  ContentFilter,
  DiagramItemActions,
  GlobalSearchHit,
  SortKey,
  ViewMode,
} from "@/pages/dashboard/dashboard.types";
import { buildBreadcrumbPath } from "@/pages/dashboard/dashboard.utils";
import { useWorkspaceFocusSync } from "@/hooks/useWorkspaceFocusSync";

/** Cap main-area folder cards; full tree stays in the sidebar. */
const RECENT_FOLDER_CARD_LIMIT = 5;

export default function DashboardPage() {
  useWorkspaceFocusSync();
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
    updateDiagram,
    updateDiagramDescription,
    duplicateDiagram,
  } = useDiagramActions();
  const { recent } = useRecentDiagrams();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFolderId = searchParams.get("f");
  const viewParam = searchParams.get("view");
  const contentFilter: ContentFilter =
    !selectedFolderId && viewParam === "recent"
      ? "recent"
      : !selectedFolderId && viewParam === "favorites"
        ? "favorites"
        : "all";

  const setSelectedFolderId = useCallback(
    (folderId: string | null) => {
      if (folderId) setSearchParams({ f: folderId }, { replace: true });
      else setSearchParams({}, { replace: true });
    },
    [setSearchParams],
  );

  const setContentFilter = useCallback(
    (nextFilter: ContentFilter) => {
      if (nextFilter === "recent") setSearchParams({ view: "recent" }, { replace: true });
      else if (nextFilter === "favorites")
        setSearchParams({ view: "favorites" }, { replace: true });
      else setSearchParams({}, { replace: true });
    },
    [setSearchParams],
  );

  const setView = useCallback(
    (nextView: "recent" | "all") => {
      setContentFilter(nextView === "recent" ? "recent" : "all");
    },
    [setContentFilter],
  );

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavoriteIds());
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  useEffect(() => {
    const f = searchParams.get("f");
    if (f && !folders[f]) {
      setSearchParams({}, { replace: true });
    }
  }, [folders, searchParams, setSearchParams]);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null | undefined>(
    undefined,
  );
  const [showAdd, setShowAdd] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeDomainFilter, setActiveDomainFilter] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const folderTreeRef = useRef<HTMLDivElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [workspaceExportOpen, setWorkspaceExportOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [renamingDiagram, setRenamingDiagram] = useState<Diagram | null>(null);
  const [movingDiagramId, setMovingDiagramId] = useState<string | null>(null);

  const isModifierActive = useModifierKey();
  const {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected: isBulkIdSelected,
  } = useMultiSelect();

  const services = useServices();

  const diagramIdSet = useMemo(() => new Set(diagrams.map((diagram) => diagram.id)), [diagrams]);

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
    const childFolders = allFolders.filter((f) => (f.parentId ?? null) === selectedFolderId);
    const folderDiagrams = diagrams.filter((d) => (d.folderId ?? null) === selectedFolderId);
    return { childFolders, folderDiagrams };
  }, [folders, diagrams, selectedFolderId]);

  const recentChildFolders = useMemo(() => {
    const scored = childFolders.map((folder) => {
      let latestUpdate = 0;
      for (const diagram of diagrams) {
        if ((diagram.folderId ?? null) !== folder.id) continue;
        if (diagram.updatedAt > latestUpdate) latestUpdate = diagram.updatedAt;
      }
      return { folder, latestUpdate };
    });
    scored.sort((a, b) => {
      if (b.latestUpdate !== a.latestUpdate) return b.latestUpdate - a.latestUpdate;
      return a.folder.name.localeCompare(b.folder.name);
    });
    return scored.slice(0, RECENT_FOLDER_CARD_LIMIT).map((row) => row.folder);
  }, [childFolders, diagrams]);

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
        (c) => c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [globalSearch, diagrams]);

  const allDomains = useMemo(
    () => [
      ...new Set(
        diagrams.map((d) => d.domain?.trim()).filter((domain): domain is string => Boolean(domain)),
      ),
    ],
    [diagrams],
  );

  const sorted = useMemo(() => {
    const arr = [...folderDiagrams];
    arr.sort((a, b) => {
      let cmp: number;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "domain") cmp = (a.domain ?? "").localeCompare(b.domain ?? "");
      else if (sortKey === "level") cmp = a.level.localeCompare(b.level);
      else cmp = a.updatedAt - b.updatedAt;
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [folderDiagrams, sortKey, sortAsc]);

  const domainFiltered = useMemo(() => {
    if (!activeDomainFilter) return sorted;
    return sorted.filter((d) => d.domain === activeDomainFilter);
  }, [sorted, activeDomainFilter]);

  const diagramsById = useMemo(
    () =>
      Object.fromEntries(diagrams.map((diagram) => [diagram.id, diagram])) as Record<
        string,
        Diagram
      >,
    [diagrams],
  );

  const recentDiagramObjects = useMemo(
    () => recent.map((entry) => diagramsById[entry.id]).filter((d): d is Diagram => Boolean(d)),
    [recent, diagramsById],
  );

  const favoriteDiagramObjects = useMemo(
    () =>
      favoriteIds
        .map((id) => diagramsById[id])
        .filter((diagram): diagram is Diagram => Boolean(diagram)),
    [favoriteIds, diagramsById],
  );

  const visibleDiagrams: Diagram[] =
    contentFilter === "recent"
      ? recentDiagramObjects
      : contentFilter === "favorites"
        ? favoriteDiagramObjects
        : domainFiltered;
  const showFolderCards = contentFilter === "all" && recentChildFolders.length > 0;
  const showDomainChips =
    contentFilter === "all" && globalSearchResults === null && allDomains.length > 0;
  const showMutationActions = contentFilter === "all";
  const showNewDiagramTile =
    showMutationActions && globalSearchResults === null && viewMode === "grid";

  const handleSelectAllVisible = useCallback(() => {
    selectAll(visibleDiagrams.map((diagram) => diagram.id));
  }, [selectAll, visibleDiagrams]);

  // Cmd/Ctrl+A picks the diagrams on screen — the current folder and filter.
  useSelectAllShortcut(handleSelectAllVisible, globalSearchResults === null);

  const handleToggleFavorite = useCallback((diagramId: string) => {
    setFavoriteIds(toggleFavoriteDiagram(diagramId));
  }, []);

  const diagramFilterChips = useMemo(
    () => [
      { value: "all" as const, label: t("common.all") },
      { value: "recent" as const, label: t("dashboard.filterRecent") },
      { value: "favorites" as const, label: t("dashboard.filterFavorites") },
    ],
    [t],
  );

  const diagramSortOptions = useMemo(
    () => [
      { key: "name" as const, label: t("common.name") },
      { key: "updatedAt" as const, label: t("common.lastEdited") },
      { key: "level" as const, label: t("common.c4Level") },
      { key: "domain" as const, label: t("common.domain") },
    ],
    [t],
  );

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
    (event: React.MouseEvent<HTMLElement>) => event.ctrlKey || event.metaKey || isModifierActive,
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
    if (diagramIds.length > 0) {
      const remaining = readFavoriteIds().filter((id) => !diagramIds.includes(id));
      writeFavoriteIds(remaining);
      setFavoriteIds(remaining);
    }
    for (const id of folderIds) {
      deleteFolder(id);
    }
    clearSelection();
    setBulkDeleteOpen(false);
  }, [clearSelection, deleteDiagram, deleteFolder, diagramIdSet, folders, selectedIds]);

  const diagramActions = useMemo<DiagramItemActions>(
    () => ({
      onRename: (diagram) => setRenamingDiagram(diagram),
      onDuplicate: (diagram) => {
        duplicateDiagram(
          diagram.id,
          t("dashboard.card.duplicatedDiagramName", { name: diagram.name }),
        );
      },
      onMove: (diagram) => setMovingDiagramId(diagram.id),
      onDelete: (diagram) => setPendingDeleteId(diagram.id),
    }),
    [duplicateDiagram, t],
  );

  const sortedFolders = useMemo(
    () => Object.values(folders).sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  );

  const pendingDeleteDiagram = pendingDeleteId
    ? (diagrams.find((diagram) => diagram.id === pendingDeleteId) ?? null)
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

  const handleDragStart = useCallback((e: React.DragEvent, diagramId: string) => {
    e.dataTransfer.setData(DIAGRAM_DRAG_MIME, diagramId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOverFolder = useCallback((folderId: string | null) => {
    setDropTargetFolderId(folderId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetFolderId(undefined);
  }, []);

  const handleDropOnFolder = useCallback(
    (folderId: string | null, diagramId: string) => {
      moveDiagram(diagramId, folderId);
      setDropTargetFolderId(undefined);
    },
    [moveDiagram],
  );

  /**
   * Diagrams filed *directly* in a folder. `FolderTree` adds up the descendants
   * itself, so this stays a flat tally.
   */
  const diagramCountByFolderId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const diagram of diagrams) {
      if (!diagram.folderId) continue;
      counts.set(diagram.folderId, (counts.get(diagram.folderId) ?? 0) + 1);
    }
    return counts;
  }, [diagrams]);

  const countDiagramsInFolder = useCallback(
    (folderId: string) => diagramCountByFolderId.get(folderId) ?? 0,
    [diagramCountByFolderId],
  );

  const diagramDrag = useMemo(
    () => ({
      mimeType: DIAGRAM_DRAG_MIME,
      dropTargetFolderId,
      onDragOverFolder: handleDragOverFolder,
      onDragLeave: handleDragLeave,
      onDropItem: handleDropOnFolder,
    }),
    [dropTargetFolderId, handleDragOverFolder, handleDragLeave, handleDropOnFolder],
  );

  const handleFolderCardDragOver = useCallback(
    (event: React.DragEvent, folderId: string) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      handleDragOverFolder(folderId);
    },
    [handleDragOverFolder],
  );

  const handleFolderCardDrop = useCallback(
    (event: React.DragEvent, folderId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const diagramId = event.dataTransfer.getData(DIAGRAM_DRAG_MIME);
      if (diagramId) handleDropOnFolder(folderId, diagramId);
      else handleDragLeave();
    },
    [handleDropOnFolder, handleDragLeave],
  );
  const currentFolderName = selectedFolderId
    ? (folders[selectedFolderId]?.name ?? t("common.emDash"))
    : contentFilter === "recent"
      ? t("dashboard.recentViewHeading")
      : contentFilter === "favorites"
        ? t("dashboard.favoritesViewHeading")
        : t("dashboard.allDiagrams");

  return (
    <div className="min-h-screen pt-14">
      <Navbar />
      <div className="flex h-[calc(100vh-3.5rem)]">
        <div ref={folderTreeRef} className="w-56 shrink-0 overflow-hidden border-r border-border">
          <FolderTree
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            countFor={countDiagramsInFolder}
            rootCount={diagrams.length}
            headerLabel={t("common.workspace")}
            allLabel={t("folderTree.allDiagrams")}
            drag={diagramDrag}
            footer={<ConnectedFolderCard />}
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
                    <BreadcrumbPage className="text-[13px]">{t("common.workspace")}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {breadcrumbPath.map((folder, i) => {
                  const isLast = i === breadcrumbPath.length - 1;
                  return (
                    <React.Fragment key={folder.id}>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="text-[13px]">{folder.name}</BreadcrumbPage>
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setWorkspaceExportOpen(true)}
                disabled={diagrams.length === 0}
                title={t("export.workspace.title")}
                aria-label={t("export.workspace.title")}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              {showMutationActions && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setImportModalOpen(true)}
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                  <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5 h-8">
                    <Plus className="h-3.5 w-3.5" /> {t("dashboard.newDiagram")}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-foreground">{currentFolderName}</h2>
            </div>

            <LibraryFilterToolbar
              chips={diagramFilterChips}
              activeChip={contentFilter}
              onChipChange={setContentFilter}
              search={globalSearch}
              onSearchChange={setGlobalSearch}
              searchPlaceholder={t("dashboard.searchComponentPlaceholder")}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortOptions={diagramSortOptions}
              onSort={handleSort}
            />

            {globalSearchResults !== null && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  {t("dashboard.resultsFor", {
                    count: globalSearchResults.length,
                    results: t(
                      globalSearchResults.length === 1
                        ? "common.result_one"
                        : "common.result_other",
                    ),
                    query: globalSearch,
                  })}
                </p>
                {globalSearchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("dashboard.noComponentsFound")}
                  </p>
                ) : (
                  <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
                    {globalSearchResults.map((c) => (
                      <button
                        key={`${c.diagramId}-${c.id}`}
                        type="button"
                        onClick={() => {
                          openDiagram(c.diagramId);
                          navigate(`/model/${c.diagramId}`);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                          {c.description && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {c.description}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground bg-secondary rounded px-2 py-0.5">
                          {c.diagramName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showDomainChips && (
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
                      setActiveDomainFilter(activeDomainFilter === domain ? null : domain)
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

            {globalSearchResults === null && showFolderCards && (
              <div className="mb-4">
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {recentChildFolders.map((folder) => {
                    const subCount = Object.values(folders).filter(
                      (f) => f.parentId === folder.id,
                    ).length;
                    const diagCount = diagrams.filter((d) => d.folderId === folder.id).length;
                    const total = subCount + diagCount;
                    return (
                      <motion.div
                        key={folder.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(event) => handleFolderCardClick(folder.id, event)}
                        onDragOver={(event) => handleFolderCardDragOver(event, folder.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(event) => handleFolderCardDrop(event, folder.id)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 transition-colors hover:bg-muted/40 hover:border-border/80",
                          isBulkIdSelected(folder.id) && "ring-2 ring-primary",
                          dropTargetFolderId === folder.id &&
                            "ring-2 ring-primary/40 border-primary/40 bg-accent/60",
                        )}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                          <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium truncate text-foreground">
                            {folder.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {total} {t(total === 1 ? "common.item_one" : "common.item_other")}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {contentFilter === "recent" &&
              globalSearchResults === null &&
              recentDiagramObjects.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                    <Clock className="h-7 w-7 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {t("dashboard.recentEmptyTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mb-4 max-w-xs">
                    {t("dashboard.recentEmptyHint")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setView("all")}
                    className="gap-1.5"
                  >
                    {t("folderTree.allDiagrams")}
                  </Button>
                </div>
              )}

            {contentFilter === "favorites" &&
              globalSearchResults === null &&
              favoriteDiagramObjects.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                    <Star className="h-7 w-7 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {t("dashboard.favoritesEmptyTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mb-4 max-w-xs">
                    {t("dashboard.favoritesEmptyHint")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContentFilter("all")}
                    className="gap-1.5"
                  >
                    {t("folderTree.allDiagrams")}
                  </Button>
                </div>
              )}

            {globalSearchResults === null &&
              (viewMode === "grid" ? (
                <DiagramGrid
                  diagrams={visibleDiagrams}
                  onSelect={handleDiagramCardSelect}
                  isDiagramSelected={isBulkIdSelected}
                  onDragStart={handleDragStart}
                  levelLabels={levelLabels}
                  showNewDiagramTile={showNewDiagramTile}
                  onNewDiagram={() => setShowAdd(true)}
                  favoriteIds={favoriteIdSet}
                  onToggleFavorite={handleToggleFavorite}
                  actions={diagramActions}
                />
              ) : (
                <DiagramList
                  diagrams={visibleDiagrams}
                  onOpen={handleOpen}
                  actions={diagramActions}
                  onDragStart={handleDragStart}
                  levelLabels={levelLabels}
                />
              ))}

            {globalSearchResults === null &&
              contentFilter === "all" &&
              domainFiltered.length === 0 &&
              childFolders.length === 0 &&
              !showNewDiagramTile && (
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
                  <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> {t("dashboard.createDiagram")}
                  </Button>
                </div>
              )}
          </div>
        </div>
      </div>

      {showAdd && <AddDiagramDialog onClose={() => setShowAdd(false)} onAdd={handleAddDiagram} />}

      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        targetFolderId={selectedFolderId}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-3">
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
              className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-2xl"
            >
              <p className="truncate text-xs font-medium text-foreground">
                {t("bulkDelete.selectionBar", { count: selectedIds.size })}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
                  {t("bulkDelete.clearSelection")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWorkspaceExportOpen(true)}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("export.workspace.exportButton")}
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
      </div>

      {bulkDeleteOpen && (
        <BulkDeleteConfirmDialog
          counts={dashboardBulkCounts}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={handleDashboardBulkDeleteConfirm}
        />
      )}

      <WorkspaceExportModal
        open={workspaceExportOpen}
        onOpenChange={setWorkspaceExportOpen}
        diagrams={diagrams}
        folders={folders}
        services={services}
        selectedIds={selectedIds}
        selectedFolderId={selectedFolderId}
      />

      <RenameDiagramModal
        open={renamingDiagram !== null}
        onOpenChange={(open) => {
          if (!open) setRenamingDiagram(null);
        }}
        diagram={renamingDiagram}
        onSave={(name, description) => {
          if (!renamingDiagram) return;
          updateDiagram(renamingDiagram.id, { name });
          updateDiagramDescription(renamingDiagram.id, description);
          setRenamingDiagram(null);
        }}
      />

      <MoveDiagramDialog
        open={movingDiagramId !== null}
        onOpenChange={(open) => {
          if (!open) setMovingDiagramId(null);
        }}
        sortedFolders={sortedFolders}
        onSelectFolder={(_event, folderId) => {
          if (movingDiagramId) moveDiagram(movingDiagramId, folderId);
          setMovingDiagramId(null);
        }}
      />

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
                const remaining = readFavoriteIds().filter((id) => id !== pendingDeleteId);
                writeFavoriteIds(remaining);
                setFavoriteIds(remaining);
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
