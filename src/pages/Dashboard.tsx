import React, { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatTimestamp } from "@/lib/format-date";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Layers,
  Clock,
  Network,
  Trash2,
  FolderOpen,
  MoreHorizontal,
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
} from "@/features/diagram";
import type { Level, Diagram, Folder } from "@/features/diagram";
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
import { Button } from "@/components/ui/button";
import { FolderTree } from "@/pages/FolderTree";
import { cn } from "@/lib/utils";

const levelColors: Record<string, string> = {
  context: "bg-[hsl(var(--node-system)/0.15)] text-[hsl(var(--node-system))]",
  container:
    "bg-[hsl(var(--node-container)/0.15)] text-[hsl(var(--node-container))]",
  component:
    "bg-[hsl(var(--node-component)/0.15)] text-[hsl(var(--node-component))]",
};

type SortKey = "name" | "domain" | "level" | "updatedAt";
type ViewMode = "grid" | "list";

function buildBreadcrumbPath(
  folders: Record<string, Folder>,
  folderId: string | null,
): Folder[] {
  if (!folderId) return [];
  const path: Folder[] = [];
  let current: Folder | undefined = folders[folderId];
  while (current) {
    path.unshift(current);
    current = current.parentId ? folders[current.parentId] : undefined;
  }
  return path;
}


const Dashboard = () => {
  const { t } = useTranslation();
  const levelLabels = useMemo(
    () => ({
      context: t("dashboard.levelContextShort"),
      container: t("dashboard.levelContainerShort"),
      component: t("dashboard.levelComponentShort"),
    }),
    [t],
  );
  const diagrams = useAllDiagrams();
  const folders = useFolders();
  const { addDiagram, openDiagram, deleteDiagram, moveDiagram } =
    useDiagramActions();
  const navigate = useNavigate();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
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

  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return null;
    return diagrams
      .flatMap((d) => Object.values(d.snapshot.components).map((c) => ({ ...c, diagramId: d.id, diagramName: d.name })))
      .filter((c) => c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q))
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

  const handleOpen = (d: Diagram) => {
    openDiagram(d.id);
    navigate(`/model/${d.id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteDiagram(id);
  };

  const handleAddDiagram = useCallback(
    (name: string, level: Level, domain?: string) => {
      const d = addDiagram(name, level, domain, selectedFolderId);
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
        {/* Sidebar */}
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

        {/* Main */}
        <div className="flex flex-1 flex-col min-w-0 bg-background">
          {/* Top bar */}
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
              {/* Global search */}
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

              {/* View toggle */}
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

              {/* Sort */}
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Title + actions */}
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

            {/* Global search results */}
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

            {/* Domain filter */}
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

            {/* Subfolders */}
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
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40 hover:border-border/80"
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

            {/* Diagrams */}
            {globalSearchResults === null && (viewMode === "grid" ? (
              <DiagramGrid
                diagrams={domainFiltered}
                onOpen={handleOpen}
                onDelete={handleDelete}
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
    </div>
  );
};

/* ── Grid view ── */
function DiagramGrid({
  diagrams,
  onOpen,
  onDelete,
  onDragStart,
  levelLabels,
}: {
  diagrams: Diagram[];
  onOpen: (d: Diagram) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  levelLabels: Record<string, string>;
}) {
  const { t } = useTranslation();
  if (diagrams.length === 0) return null;
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {diagrams.map((d, i) => (
        <motion.div
          key={d.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          draggable
          onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, d.id)}
          onClick={() => onOpen(d)}
          className="group cursor-pointer rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]"
        >
          {/* Preview area */}
          <div className="relative h-28 bg-muted/30 flex items-center justify-center border-b border-border/50">
            <div className="flex items-center gap-3 opacity-40">
              <div className="h-6 w-10 rounded border border-current" />
              <div className="h-px w-6 bg-current" />
              <div className="h-6 w-10 rounded border border-current" />
            </div>
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            {/* Actions */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem onClick={() => onOpen(d)}>
                    {t("common.open")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => onDelete(e, d.id)}
                  >
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Info */}
          <div className="p-3">
            <p className="text-sm font-medium text-foreground truncate mb-1.5">
              {d.name}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  levelColors[d.level] ?? "bg-muted text-muted-foreground",
                )}
              >
                {levelLabels[d.level]}
              </span>
              <span
                className="text-[11px] text-muted-foreground/60 ml-auto"
                title={`${t("common.created")}: ${formatTimestamp(d.createdAt)}`}
              >
                {formatTimestamp(d.updatedAt)}
              </span>
            </div>
            {d.domain && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                {d.domain}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── List view ── */
function DiagramList({
  diagrams,
  onOpen,
  onDelete,
  onDragStart,
  levelLabels,
}: {
  diagrams: Diagram[];
  onOpen: (d: Diagram) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  levelLabels: Record<string, string>;
}) {
  const { t } = useTranslation();
  if (diagrams.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-10 px-3 py-2.5" />
            <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("common.name")}
            </th>
            <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("common.domain")}
            </th>
            <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("common.c4Level")}
            </th>
            <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("common.edited")}
            </th>
            <th className="w-10 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {diagrams.map((d) => (
            <tr
              key={d.id}
              draggable
              onDragStart={(e) => onDragStart(e, d.id)}
              onClick={() => onOpen(d)}
              className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors group"
            >
              <td className="px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <Network className="h-3.5 w-3.5 text-primary" />
                </div>
              </td>
              <td className="px-3 py-2.5 font-medium text-foreground">
                {d.name}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {d.domain ?? t("common.emDash")}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    levelColors[d.level] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {levelLabels[d.level]}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(d.updatedAt)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 pl-4">
                    {t("common.created")}: {formatTimestamp(d.createdAt)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <button
                  onClick={(e) => onDelete(e, d.id)}
                  className="text-muted-foreground/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Add diagram dialog ── */
const AddDiagramDialog = ({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, level: Level, domain?: string) => void;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("context");
  const [domain, setDomain] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">{t("dashboard.addDiagramTitle")}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("common.name")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("dashboard.namePlaceholder")}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("common.c4Level")}
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="context">{t("dashboard.levelContext")}</option>
              <option value="container">{t("dashboard.levelContainer")}</option>
              <option value="component">{t("dashboard.levelComponent")}</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("dashboard.domainOptional")}
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={t("dashboard.domainPlaceholder")}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} size="sm">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              if (name.trim())
                onAdd(name.trim(), level, domain.trim() || undefined);
            }}
            disabled={!name.trim()}
            size="sm"
          >
            {t("dashboard.createDiagram")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
