import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  PanelLeftClose,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Diagram, Folder as FolderType, Flow } from "@/features/diagram";
import { useAllDiagrams, useFolders, useFlows } from "@/features/diagram";
import { useFlowMode } from "@/features/canvas/flow/FlowModeContext";
import { buildBreadcrumbPath } from "@/pages/dashboard/dashboard.utils";
import { useRecentDiagrams } from "./useRecentDiagrams";
import {
  readSidebarExpandedFolderIds,
  writeSidebarExpandedFolderIds,
} from "./sidebarFolderStorage";

type FolderRecord = Record<string, FolderType>;

function getChildFolders(folders: FolderRecord, parentId: string | null): FolderType[] {
  return Object.values(folders)
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getDiagramsInFolder(diagrams: Diagram[], folderId: string | null): Diagram[] {
  return diagrams
    .filter((diagram) => (diagram.folderId ?? null) === folderId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function ancestorFolderIds(folders: FolderRecord, folderId: string | null): string[] {
  const chain: string[] = [];
  let cur: string | null = folderId;
  while (cur) {
    chain.push(cur);
    cur = folders[cur]?.parentId ?? null;
  }
  return chain;
}

function diagramMatchesSearch(
  diagram: Diagram,
  folders: FolderRecord,
  q: string,
): boolean {
  const lc = q.trim().toLowerCase();
  if (!lc) return true;
  if (diagram.name.toLowerCase().includes(lc)) return true;
  const path = buildBreadcrumbPath(folders, diagram.folderId ?? null);
  return path.some((crumb) => crumb.name.toLowerCase().includes(lc));
}

export interface DiagramSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiagramId: string;
  onSelectDiagram: (id: string) => void;
}

export function DiagramSidebar({
  isOpen,
  onClose,
  currentDiagramId,
  onSelectDiagram,
}: DiagramSidebarProps) {
  const { t, i18n } = useTranslation();
  const folders = useFolders();
  const allDiagrams = useAllDiagrams();
  const flows = useFlows();
  const flowMode = useFlowMode();
  const playbackState = flowMode.mode.kind === "playing" ? flowMode.mode : null;
  const activeFlow = playbackState?.flow ?? null;
  const play = flowMode.play;
  const { recent } = useRecentDiagrams();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(readSidebarExpandedFolderIds);
  const activeDiagramRef = useRef<HTMLButtonElement | null>(null);

  const locale = i18n.language.startsWith("pt") ? ptBR : enUS;

  const diagramsById = useMemo(
    () =>
      Object.fromEntries(allDiagrams.map((diagram) => [diagram.id, diagram])) as Record<
        string,
        Diagram
      >,
    [allDiagrams],
  );

  const recentResolved = useMemo(() => {
    return recent
      .map((entry) => {
        const diagram = diagramsById[entry.id];
        return diagram
          ? { id: entry.id, openedAt: entry.openedAt, name: diagram.name }
          : null;
      })
      .filter((row): row is { id: string; openedAt: number; name: string } => row !== null);
  }, [recent, diagramsById]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSidebarExpandedFolderIds(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !currentDiagramId) return;
    const activeDiagram = diagramsById[currentDiagramId];
    if (!activeDiagram?.folderId) return;
    const chain = ancestorFolderIds(folders, activeDiagram.folderId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      chain.forEach((id) => next.add(id));
      writeSidebarExpandedFolderIds(next);
      return next;
    });
  }, [isOpen, currentDiagramId, diagramsById, folders]);

  useEffect(() => {
    if (!isOpen) return;
    const tmr = requestAnimationFrame(() => {
      activeDiagramRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(tmr);
  }, [isOpen, currentDiagramId]);

  const handleSelectDiagram = useCallback(
    (id: string) => {
      onSelectDiagram(id);
      onClose();
    },
    [onSelectDiagram, onClose],
  );

  const searchTrim = searchQuery.trim();
  const showSearchResults = searchTrim.length > 0;

  const matchingDiagrams = useMemo(() => {
    if (!showSearchResults) return [];
    return allDiagrams.filter((diagram) => diagramMatchesSearch(diagram, folders, searchTrim));
  }, [allDiagrams, folders, searchTrim, showSearchResults]);

  return (
    <div
      className={cn(
        "h-full overflow-hidden bg-card border-r border-border shadow-lg transition-[width] duration-200 ease-in-out",
        isOpen ? "w-[260px]" : "w-0",
      )}
      aria-hidden={!isOpen}
    >
      <div
        className={cn(
          "flex h-full min-w-[260px] flex-col",
          !isOpen && "pointer-events-none opacity-0",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <PanelLeftClose className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{t("common.workspace")}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
            aria-label={t("diagramNav.closeSidebar")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-2 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("diagramNav.searchDiagrams")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {showSearchResults ? (
            <div className="space-y-1">
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("diagramNav.diagrams")}
              </p>
              {matchingDiagrams.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  {t("diagramNav.noMatches")}
                </p>
              ) : (
                matchingDiagrams.map((diagram) => {
                  const path = buildBreadcrumbPath(folders, diagram.folderId ?? null);
                  const pathLabel = path.map((crumb) => crumb.name).join(" / ");
                  const isActive = diagram.id === currentDiagramId;
                  return (
                    <button
                      key={diagram.id}
                      type="button"
                      ref={isActive ? activeDiagramRef : undefined}
                      onClick={() => handleSelectDiagram(diagram.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                        isActive
                          ? "bg-primary/15 font-medium text-primary"
                          : "text-foreground/80 hover:bg-muted",
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="min-w-0 flex-1 truncate">{diagram.name}</span>
                      {pathLabel && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {pathLabel}
                        </span>
                      )}
                      {isActive && <span className="text-primary">●</span>}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <>
              <div className="mb-3">
                <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("diagramNav.recent")}
                </p>
                <div className="space-y-0.5">
                  {recentResolved.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">{t("diagramNav.emptyRecent")}</p>
                  ) : (
                    recentResolved.map((recentEntry) => {
                      const isActive = recentEntry.id === currentDiagramId;
                      return (
                        <button
                          key={recentEntry.id}
                          type="button"
                          onClick={() => handleSelectDiagram(recentEntry.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                            isActive
                              ? "bg-primary/15 font-medium text-primary"
                              : "text-foreground/80 hover:bg-muted",
                          )}
                        >
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{recentEntry.name}</span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {formatDistanceToNow(recentEntry.openedAt, { addSuffix: true, locale })}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("diagramNav.folders")}
                </p>
                <SidebarFolderTree
                  folders={folders}
                  allDiagrams={allDiagrams}
                  depth={0}
                  parentId={null}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  currentDiagramId={currentDiagramId}
                  onSelectDiagram={handleSelectDiagram}
                  flows={flows}
                  activeFlow={activeFlow}
                  onSelectFlow={(flow) => {
                    play(flow);
                    onClose();
                  }}
                  activeDiagramRef={activeDiagramRef}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface SidebarFolderTreeProps {
  folders: FolderRecord;
  allDiagrams: Diagram[];
  depth: number;
  parentId: string | null;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  currentDiagramId: string;
  onSelectDiagram: (id: string) => void;
  flows: Flow[];
  activeFlow: Flow | null;
  onSelectFlow: (flow: Flow) => void;
  activeDiagramRef: RefObject<HTMLButtonElement | null>;
}

function SidebarFolderTree({
  folders,
  allDiagrams,
  depth,
  parentId,
  expandedIds,
  toggleExpand,
  currentDiagramId,
  onSelectDiagram,
  flows,
  activeFlow,
  onSelectFlow,
  activeDiagramRef,
}: SidebarFolderTreeProps) {
  const childFolders = getChildFolders(folders, parentId);
  const diagramsHere = getDiagramsInFolder(allDiagrams, parentId);

  return (
    <div className="space-y-0.5">
      {diagramsHere.map((diagram) => (
        <div key={diagram.id}>
          <DiagramTreeRow
            diagram={diagram}
            depth={depth}
            isActive={diagram.id === currentDiagramId}
            onSelect={() => onSelectDiagram(diagram.id)}
            activeDiagramRef={activeDiagramRef}
          />
          {diagram.id === currentDiagramId && flows.length > 0 && (
            <div
              className="ml-2 border-l border-border/70 pl-2"
              style={{ marginLeft: `${10 + depth * 14}px` }}
            >
              {flows.map((flow) => {
                const isFlowActive = activeFlow?.id === flow.id;
                return (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => onSelectFlow(flow)}
                    className={cn(
                      "flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[12px] transition-colors",
                      isFlowActive ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground/80">├</span>
                    <span className="min-w-0 flex-1 truncate">{flow.name}</span>
                    {isFlowActive && <span className="text-primary">●</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {childFolders.map((folder) => (
        <SidebarFolderNode
          key={folder.id}
          folder={folder}
          folders={folders}
          allDiagrams={allDiagrams}
          depth={depth}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          currentDiagramId={currentDiagramId}
          onSelectDiagram={onSelectDiagram}
          flows={flows}
          activeFlow={activeFlow}
          onSelectFlow={onSelectFlow}
          activeDiagramRef={activeDiagramRef}
        />
      ))}
    </div>
  );
}

function DiagramTreeRow({
  diagram,
  depth,
  isActive,
  onSelect,
  activeDiagramRef,
}: {
  diagram: Diagram;
  depth: number;
  isActive: boolean;
  onSelect: () => void;
  activeDiagramRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      type="button"
      ref={isActive ? activeDiagramRef : undefined}
      onClick={onSelect}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[13px] transition-colors",
        isActive ? "bg-primary/15 font-medium text-primary" : "text-foreground/80 hover:bg-muted",
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{diagram.name}</span>
      {isActive && <span className="text-primary">●</span>}
    </button>
  );
}

function SidebarFolderNode({
  folder,
  folders,
  allDiagrams,
  depth,
  expandedIds,
  toggleExpand,
  currentDiagramId,
  onSelectDiagram,
  flows,
  activeFlow,
  onSelectFlow,
  activeDiagramRef,
}: {
  folder: FolderType;
  folders: FolderRecord;
  allDiagrams: Diagram[];
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  currentDiagramId: string;
  onSelectDiagram: (id: string) => void;
  flows: Flow[];
  activeFlow: Flow | null;
  onSelectFlow: (flow: Flow) => void;
  activeDiagramRef: RefObject<HTMLButtonElement | null>;
}) {
  const children = getChildFolders(folders, folder.id);
  const diagramsHere = getDiagramsInFolder(allDiagrams, folder.id);
  const hasChildren = children.length > 0 || diagramsHere.length > 0;
  const isExpanded = expandedIds.has(folder.id);

  return (
    <div>
      <div
        className="flex items-center gap-0.5 rounded-md py-0.5 text-[13px]"
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted"
          onClick={() => toggleExpand(folder.id)}
          aria-expanded={isExpanded}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pr-1 text-left hover:bg-muted/80"
          onClick={() => toggleExpand(folder.id)}
        >
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-600/80" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-amber-600/80" />
          )}
          <span className="truncate font-medium">{folder.name}</span>
        </button>
      </div>

      {isExpanded && (
        <div className="relative">
          <div
            className="absolute bottom-0 top-0 w-px bg-border/60"
            style={{ left: `${12 + depth * 14}px` }}
          />
          <SidebarFolderTree
            folders={folders}
            allDiagrams={allDiagrams}
            depth={depth + 1}
            parentId={folder.id}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            currentDiagramId={currentDiagramId}
            onSelectDiagram={onSelectDiagram}
            flows={flows}
            activeFlow={activeFlow}
            onSelectFlow={onSelectFlow}
            activeDiagramRef={activeDiagramRef}
          />
        </div>
      )}
    </div>
  );
}
