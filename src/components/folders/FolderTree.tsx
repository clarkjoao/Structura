import { useState, useCallback, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  MoreHorizontal,
  Plus,
  Home,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { KEY, keyIs } from "@/lib/core/keyboard";
import type { Folder as FolderType } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import { useTranslation } from "react-i18next";

const ADD_AT_ROOT = "__add_at_root__";

type FolderRecord = Record<string, FolderType>;

function getChildFolders(folders: FolderRecord, parentId: string | null): FolderType[] {
  return Object.values(folders).filter((f) => f.parentId === parentId);
}

/**
 * Items filed in each folder, counting everything filed below it.
 *
 * Done here rather than in each host because a collapsed folder that holds
 * nothing itself must not read as empty when its children are not — and both
 * libraries owe their readers the same answer. Hosts supply only the direct
 * tally; the tree already knows the shape of the graph.
 *
 * One bottom-up pass over the folders, so a deep tree costs no more than a
 * flat one.
 */
function buildDescendantTotals(
  folders: FolderRecord,
  countFor: (folderId: string) => number,
): Map<string, number> {
  const totals = new Map<string, number>();

  const visit = (folderId: string): number => {
    const cached = totals.get(folderId);
    if (cached !== undefined) return cached;
    // Guard against a cycle in malformed folder data: claim the slot before
    // recursing, so a parentId loop terminates instead of blowing the stack.
    totals.set(folderId, 0);
    let total = countFor(folderId);
    for (const child of getChildFolders(folders, folderId)) {
      total += visit(child.id);
    }
    totals.set(folderId, total);
    return total;
  };

  for (const folderId of Object.keys(folders)) visit(folderId);
  return totals;
}

/**
 * Filing by dragging. Omit it and the tree accepts no drops at all.
 *
 * `mimeType` is what keeps the two libraries from accepting each other's
 * cards: a diagram dragged onto the walkthrough tree carries a type the
 * walkthrough tree never reads, so the drop yields no id and nothing moves.
 */
export interface FolderTreeDrag {
  /** The `dataTransfer` type carrying the dragged item's id. */
  mimeType: string;
  dropTargetFolderId: string | null | undefined;
  onDragOverFolder: (folderId: string | null) => void;
  onDragLeave: () => void;
  onDropItem: (folderId: string | null, itemId: string) => void;
}

export interface FolderTreeProps {
  folders: FolderRecord;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  /** Items filed *directly* in this folder. The tree adds up the descendants. */
  countFor: (folderId: string) => number;
  /** The tally beside the "everything" row. */
  rootCount: number;
  /** Heading above the search box. */
  headerLabel: string;
  /** Label of the "everything" row at the top of the tree. */
  allLabel: string;
  drag?: FolderTreeDrag;
  /** Rendered under the tree — the workspace puts its connected-folder card here. */
  footer?: ReactNode;
  triggerAddFolderAtRoot?: number;
}

/**
 * The folder rail, shared by the diagram workspace and the walkthrough library.
 *
 * Both file into the *same* folders — the ones that live in the diagram store —
 * so folder CRUD goes through `useDiagramActions` here rather than being handed
 * in. What differs between the two libraries is only what is being counted and
 * what may be dropped, and those arrive as props.
 */
export function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  countFor,
  rootCount,
  headerLabel,
  allLabel,
  drag,
  footer,
  triggerAddFolderAtRoot = 0,
}: FolderTreeProps) {
  const { t } = useTranslation();
  const { addFolder, renameFolder, deleteFolder } = useDiagramActions();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingUnderParent, setAddingUnderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const descendantTotals = useMemo(
    () => buildDescendantTotals(folders, countFor),
    [folders, countFor],
  );

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

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    drag.onDragOverFolder(folderId);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    if (!drag) return;
    e.preventDefault();
    const itemId = e.dataTransfer.getData(drag.mimeType);
    if (itemId) drag.onDropItem(folderId, itemId);
    drag.onDragLeave();
  };

  const filteredRootFolders = searchQuery.trim()
    ? rootFolders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : rootFolders;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center px-3 pt-3 pb-1">
        <span className="text-[11px] font-semibold text-sidebar-foreground/60 uppercase tracking-widest">
          {headerLabel}
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
        <div
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
            selectedFolderId === null
              ? "bg-accent text-accent-foreground font-semibold"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            drag?.dropTargetFolderId === null && "ring-1 ring-sidebar-ring/50 bg-sidebar-accent/60",
          )}
          onClick={() => onSelectFolder(null)}
          onDragOver={(e) => handleDragOver(e, null)}
          onDragLeave={drag?.onDragLeave}
          onDrop={(e) => handleDrop(e, null)}
        >
          <Home className="h-4 w-4 shrink-0 opacity-60" strokeWidth={1.75} />
          <span className="flex-1 truncate">{allLabel}</span>
          <span className="text-[11px] text-sidebar-foreground/40 tabular-nums">{rootCount}</span>
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
            descendantTotals={descendantTotals}
            depth={0}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            drag={drag}
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
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">
            {t("folderTree.noFoldersFound")}
          </p>
        )}
      </div>
      {footer}
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
  descendantTotals: Map<string, number>;
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  drag: FolderTreeDrag | undefined;
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
  descendantTotals,
  depth,
  expandedIds,
  toggleExpand,
  selectedFolderId,
  onSelectFolder,
  drag,
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
  const totalCount = descendantTotals.get(folder.id) ?? 0;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const isDropTarget = drag?.dropTargetFolderId === folder.id;
  const isEditing = editingId === folder.id;

  const handleDragOver = (e: React.DragEvent) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    drag.onDragOverFolder(folder.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!drag) return;
    e.preventDefault();
    const itemId = e.dataTransfer.getData(drag.mimeType);
    if (itemId) drag.onDropItem(folder.id, itemId);
    drag.onDragLeave();
  };

  return (
    <div>
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md py-[5px] pr-1 text-[13px] transition-all",
          isSelected
            ? "bg-accent text-accent-foreground font-semibold"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          isDropTarget && "ring-1 ring-sidebar-ring/50 bg-sidebar-accent/60",
        )}
        style={{ paddingLeft: `${20 + depth * 14}px` }}
        onClick={() => !isEditing && onSelectFolder(folder.id)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isEditing) startRename(folder);
        }}
        onDragOver={handleDragOver}
        onDragLeave={drag?.onDragLeave}
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
              <ChevronDown className="h-3 w-3 text-sidebar-foreground/50" strokeWidth={1.75} />
            ) : (
              <ChevronRight className="h-3 w-3 text-sidebar-foreground/50" strokeWidth={1.75} />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
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
              descendantTotals={descendantTotals}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              drag={drag}
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
