import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  MoreHorizontal,
  Plus,
  Home,
  Search,
  FileText,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { KEY, keyIs } from "@/lib/keyboard-utils";
import type { Folder as FolderType, Diagram } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import { buildBreadcrumbPath } from "@/pages/dashboard/dashboard.utils";
import { useTranslation } from "react-i18next";

const ADD_AT_ROOT = "__add_at_root__";
const RECENT_PREVIEW_LIMIT = 4;

type FolderRecord = Record<string, FolderType>;

function getChildFolders(folders: FolderRecord, parentId: string | null): FolderType[] {
  return Object.values(folders).filter((f) => f.parentId === parentId);
}

function countAllDescendantDiagrams(
  folders: FolderRecord,
  diagrams: Diagram[],
  folderId: string,
): number {
  let count = diagrams.filter((d) => d.folderId === folderId).length;
  const children = getChildFolders(folders, folderId);
  for (const child of children) {
    count += countAllDescendantDiagrams(folders, diagrams, child.id);
  }
  return count;
}

export interface FolderTreeRecentItem {
  id: string;
  openedAt: number;
  name: string;
  folderId: string | null;
}

interface FolderTreeProps {
  folders: FolderRecord;
  diagrams: Diagram[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  dropTargetFolderId: string | null | undefined;
  onDragOverFolder: (folderId: string | null) => void;
  onDragLeave: () => void;
  onDropOnFolder: (folderId: string | null, diagramId: string) => void;
  triggerAddFolderAtRoot?: number;
  recentDiagrams?: FolderTreeRecentItem[];
  recentCount?: number;
  recentViewActive?: boolean;
  locale?: string;
  onSelectRecentView?: () => void;
  onOpenRecent?: (diagramId: string) => void;
}

export function FolderTree({
  folders,
  diagrams,
  selectedFolderId,
  onSelectFolder,
  dropTargetFolderId,
  onDragOverFolder,
  onDragLeave,
  onDropOnFolder,
  triggerAddFolderAtRoot = 0,
  recentDiagrams = [],
  recentCount = 0,
  recentViewActive = false,
  locale,
  onSelectRecentView,
  onOpenRecent,
}: FolderTreeProps) {
  const { t } = useTranslation();
  const { addFolder, renameFolder, deleteFolder } = useDiagramActions();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingUnderParent, setAddingUnderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startRename = useCallback((folder: FolderType) => {
    setEditingId(folder.id);
    setEditName(folder.name);
  }, []);

  const submitRename = useCallback(() => {
    if (editingId && editName.trim()) {
      renameFolder(editingId, editName.trim());
      setEditingId(null);
      setEditName("");
    }
  }, [editingId, editName, renameFolder]);

  const startAddSubfolder = useCallback((parentId: string | null) => {
    setAddingUnderParent(parentId === null ? ADD_AT_ROOT : parentId);
    setNewFolderName("");
    if (parentId) {
      setExpandedIds((prev) => new Set(prev).add(parentId));
    }
  }, []);

  const addFolderAtRoot = useCallback(() => {
    setAddingUnderParent(ADD_AT_ROOT);
    setNewFolderName("");
  }, []);

  useEffect(() => {
    if (triggerAddFolderAtRoot > 0) addFolderAtRoot();
  }, [triggerAddFolderAtRoot, addFolderAtRoot]);

  const submitAddFolder = useCallback(() => {
    if (newFolderName.trim()) {
      const parentId = addingUnderParent === ADD_AT_ROOT ? null : addingUnderParent;
      const created = addFolder(newFolderName.trim(), parentId ?? null);
      if (addingUnderParent && addingUnderParent !== ADD_AT_ROOT) {
        setExpandedIds((p) => new Set(p).add(addingUnderParent));
      }
      setAddingUnderParent(null);
      setNewFolderName("");
      onSelectFolder(created.id);
    }
  }, [newFolderName, addingUnderParent, addFolder, onSelectFolder]);

  const handleDeleteFolder = useCallback(
    (id: string) => {
      deleteFolder(id);
      if (selectedFolderId === id) onSelectFolder(null);
    },
    [deleteFolder, selectedFolderId, onSelectFolder],
  );

  const rootFolders = getChildFolders(folders, null);
  const totalDiagrams = diagrams.length;

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDragOverFolder(folderId);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const diagramId = e.dataTransfer.getData("application/x-structura-diagram-id");
    if (diagramId) onDropOnFolder(folderId, diagramId);
    onDragLeave();
  };

  const filteredRootFolders = searchQuery.trim()
    ? rootFolders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : rootFolders;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center px-3 pt-3 pb-1">
        <span className="text-[11px] font-semibold text-sidebar-foreground/60 uppercase tracking-widest">
          {t("common.workspace")}
        </span>
      </div>

      <div className="px-2 py-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/30" />
          <Input
            placeholder={t("folderTree.searchFoldersPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs bg-sidebar-accent/50 border-0 text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus-visible:ring-1 focus-visible:ring-sidebar-ring/50"
          />
        </div>
        <Button
          variant="default"
          size="sm"
          className="mt-1.5 h-8 w-full justify-start gap-1.5"
          onClick={addFolderAtRoot}
          title={t("folderTree.newFolderTitle")}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("folderTree.newFolder")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
        {onSelectRecentView && (
          <RecentSection
            recentDiagrams={recentDiagrams}
            recentCount={recentCount}
            recentViewActive={recentViewActive}
            folders={folders}
            locale={locale ?? "en"}
            onSelectRecentView={onSelectRecentView}
            onOpenRecent={onOpenRecent ?? noop}
          />
        )}
        <div
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
            selectedFolderId === null
              ? "bg-sidebar-accent text-sidebar-foreground font-medium"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            dropTargetFolderId === null && "ring-1 ring-sidebar-ring/50 bg-sidebar-accent/60",
          )}
          onClick={() => onSelectFolder(null)}
          onDragOver={(e) => handleDragOver(e, null)}
          onDragLeave={onDragLeave}
          onDrop={(e) => handleDrop(e, null)}
        >
          <Home className="h-4 w-4 shrink-0 opacity-60" />
          <span className="flex-1 truncate">{t("folderTree.allDiagrams")}</span>
          <span className="text-[11px] text-sidebar-foreground/40 tabular-nums">
            {totalDiagrams}
          </span>
        </div>
        <div className="h-px bg-sidebar-border mx-1 my-1.5" />

        {addingUnderParent === ADD_AT_ROOT && (
          <NewFolderInput
            value={newFolderName}
            onChange={setNewFolderName}
            onSubmit={submitAddFolder}
            onCancel={() => setAddingUnderParent(null)}
            depth={0}
          />
        )}

        {filteredRootFolders.map((folder) => (
          <FolderTreeItem
            key={folder.id}
            folder={folder}
            folders={folders}
            diagrams={diagrams}
            depth={0}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            dropTargetFolderId={dropTargetFolderId}
            onDragOverFolder={onDragOverFolder}
            onDragLeave={onDragLeave}
            onDropOnFolder={onDropOnFolder}
            editingId={editingId}
            editName={editName}
            setEditName={setEditName}
            submitRename={submitRename}
            setEditingId={setEditingId}
            startRename={startRename}
            handleDeleteFolder={handleDeleteFolder}
            startAddSubfolder={startAddSubfolder}
            addingUnderParent={addingUnderParent}
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            submitAddFolder={submitAddFolder}
            setAddingUnderParent={setAddingUnderParent}
          />
        ))}

        {filteredRootFolders.length === 0 && searchQuery && (
          <p className="px-3 py-4 text-xs text-sidebar-foreground/40 text-center">
            {t("folderTree.noFoldersFound")}
          </p>
        )}
      </div>
    </div>
  );
}

function noop() {
  // Placeholder open handler when caller doesn't provide one — keeps Recently
  // items unclickable rather than throwing.
}

function RecentSection({
  recentDiagrams,
  recentCount,
  recentViewActive,
  folders,
  locale,
  onSelectRecentView,
  onOpenRecent,
}: {
  recentDiagrams: FolderTreeRecentItem[];
  recentCount: number;
  recentViewActive: boolean;
  folders: FolderRecord;
  locale: string;
  onSelectRecentView: () => void;
  onOpenRecent: (diagramId: string) => void;
}) {
  const { t } = useTranslation();
  const dateLocale = locale.startsWith("pt") ? ptBR : enUS;
  const preview = useMemo(() => recentDiagrams.slice(0, RECENT_PREVIEW_LIMIT), [recentDiagrams]);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onSelectRecentView}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
          recentViewActive
            ? "bg-sidebar-accent text-sidebar-foreground font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
        aria-pressed={recentViewActive}
      >
        <Clock className="h-4 w-4 shrink-0 opacity-60" />
        <span className="flex-1 truncate text-left">{t("folderTree.recentLabel")}</span>
        <span className="text-[11px] text-sidebar-foreground/40 tabular-nums">{recentCount}</span>
      </button>

      <div className="mt-0.5 ml-3 space-y-0.5">
        {preview.length === 0 ? (
          <p className="px-2 py-1 text-xs text-sidebar-foreground/40">
            {t("diagramNav.emptyRecent")}
          </p>
        ) : (
          preview.map((entry) => {
            const path = buildBreadcrumbPath(folders, entry.folderId);
            const pathLabel = path.map((crumb) => crumb.name).join(" / ");
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenRecent(entry.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] transition-colors text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                title={entry.name}
              >
                <FileText className="h-3 w-3 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                {pathLabel && (
                  <span className="hidden lg:inline shrink-0 text-[10px] text-sidebar-foreground/40 truncate max-w-[80px]">
                    {pathLabel}
                  </span>
                )}
                <span className="shrink-0 text-[10px] tabular-nums text-sidebar-foreground/40">
                  {formatDistanceToNow(entry.openedAt, { addSuffix: true, locale: dateLocale })}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="h-px bg-sidebar-border mx-1 my-1.5" />
    </div>
  );
}

function NewFolderInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  depth,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  depth: number;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-2 py-1"
      style={{ paddingLeft: `${8 + depth * 14}px` }}
    >
      <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
      <Input
        placeholder={t("folderTree.folderNamePlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (keyIs(e, KEY.ENTER)) onSubmit();
          if (keyIs(e, KEY.ESCAPE)) onCancel();
        }}
        onBlur={() => {
          if (value.trim()) onSubmit();
          else onCancel();
        }}
        className="h-6 flex-1 min-w-0 border-0 bg-sidebar-accent text-xs text-sidebar-foreground focus-visible:ring-1 focus-visible:ring-sidebar-ring/50 px-1.5"
        autoFocus
      />
    </div>
  );
}

interface FolderTreeItemProps {
  folder: FolderType;
  folders: FolderRecord;
  diagrams: Diagram[];
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  dropTargetFolderId: string | null | undefined;
  onDragOverFolder: (folderId: string | null) => void;
  onDragLeave: () => void;
  onDropOnFolder: (folderId: string | null, diagramId: string) => void;
  editingId: string | null;
  editName: string;
  setEditName: (v: string) => void;
  submitRename: () => void;
  setEditingId: (v: string | null) => void;
  startRename: (folder: FolderType) => void;
  handleDeleteFolder: (id: string) => void;
  startAddSubfolder: (parentId: string | null) => void;
  addingUnderParent: string | null;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  submitAddFolder: () => void;
  setAddingUnderParent: (v: string | null) => void;
}

function FolderTreeItem({
  folder,
  folders,
  diagrams,
  depth,
  expandedIds,
  toggleExpand,
  selectedFolderId,
  onSelectFolder,
  dropTargetFolderId,
  onDragOverFolder,
  onDragLeave,
  onDropOnFolder,
  editingId,
  editName,
  setEditName,
  submitRename,
  setEditingId,
  startRename,
  handleDeleteFolder,
  startAddSubfolder,
  addingUnderParent,
  newFolderName,
  setNewFolderName,
  submitAddFolder,
  setAddingUnderParent,
}: FolderTreeItemProps) {
  const { t } = useTranslation();
  const children = getChildFolders(folders, folder.id);
  const totalCount = countAllDescendantDiagrams(folders, diagrams, folder.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const isDropTarget = dropTargetFolderId === folder.id;
  const isEditing = editingId === folder.id;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDragOverFolder(folder.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const diagramId = e.dataTransfer.getData("application/x-structura-diagram-id");
    if (diagramId) onDropOnFolder(folder.id, diagramId);
    onDragLeave();
  };

  return (
    <div>
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md py-[5px] pr-1 text-[13px] transition-all",
          isSelected
            ? "bg-sidebar-accent text-sidebar-foreground font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          isDropTarget && "ring-1 ring-sidebar-ring/50 bg-sidebar-accent/60",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => !isEditing && onSelectFolder(folder.id)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isEditing) startRename(folder);
        }}
        onDragOver={handleDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
      >
        {}
        <button
          type="button"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors hover:bg-sidebar-accent"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(folder.id);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-sidebar-foreground/50" />
            ) : (
              <ChevronRight className="h-3 w-3 text-sidebar-foreground/50" />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500/80" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-amber-500/80" />
        )}
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (keyIs(e, KEY.ENTER)) submitRename();
              if (keyIs(e, KEY.ESCAPE)) setEditingId(null);
            }}
            onBlur={submitRename}
            onClick={(e) => e.stopPropagation()}
            className="h-5 flex-1 min-w-0 border-0 bg-sidebar-accent text-xs text-sidebar-foreground focus-visible:ring-1 focus-visible:ring-sidebar-ring/50 px-1"
            autoFocus
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
        )}
        {!isEditing && (
          <>
            {totalCount > 0 && (
              <span className="shrink-0 text-[11px] text-sidebar-foreground/40 tabular-nums mr-0.5">
                {totalCount}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[140px]"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onClick={() => startRename(folder)}>
                  {t("folderTree.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => startAddSubfolder(folder.id)}>
                  {t("folderTree.newSubfolder")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleDeleteFolder(folder.id)}
                >
                  {t("folderTree.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {isExpanded && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-sidebar-border/50"
            style={{ left: `${14 + depth * 14}px` }}
          />
          {addingUnderParent === folder.id && (
            <NewFolderInput
              value={newFolderName}
              onChange={setNewFolderName}
              onSubmit={submitAddFolder}
              onCancel={() => setAddingUnderParent(null)}
              depth={depth + 1}
            />
          )}
          {children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              folders={folders}
              diagrams={diagrams}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              dropTargetFolderId={dropTargetFolderId}
              onDragOverFolder={onDragOverFolder}
              onDragLeave={onDragLeave}
              onDropOnFolder={onDropOnFolder}
              editingId={editingId}
              editName={editName}
              setEditName={setEditName}
              submitRename={submitRename}
              setEditingId={setEditingId}
              startRename={startRename}
              handleDeleteFolder={handleDeleteFolder}
              startAddSubfolder={startAddSubfolder}
              addingUnderParent={addingUnderParent}
              newFolderName={newFolderName}
              setNewFolderName={setNewFolderName}
              submitAddFolder={submitAddFolder}
              setAddingUnderParent={setAddingUnderParent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
