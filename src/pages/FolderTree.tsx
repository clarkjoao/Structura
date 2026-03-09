import { useState, useCallback, useEffect } from "react";
import { ChevronRight, ChevronDown, FolderOpen, Folder, MoreHorizontal, Plus, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Folder as FolderType, Diagram } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";

const ROOT_ID = "__root__";
const ADD_AT_ROOT = "__add_at_root__";

type FolderRecord = Record<string, FolderType>;

function getChildFolders(folders: FolderRecord, parentId: string | null): FolderType[] {
  return Object.values(folders).filter((f) => f.parentId === parentId);
}

interface FolderTreeProps {
  folders: FolderRecord;
  diagrams: Diagram[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  /** null = root is drop target, string = folder id, undefined = no drop target */
  dropTargetFolderId: string | null | undefined;
  onDragOverFolder: (folderId: string | null) => void;
  onDragLeave: () => void;
  onDropOnFolder: (folderId: string | null, diagramId: string) => void;
  /** When this increments, open the "add folder at root" inline input (e.g. from main area "+ New Folder" button). */
  triggerAddFolderAtRoot?: number;
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
}: FolderTreeProps) {
  const { addFolder, renameFolder, deleteFolder } = useDiagramActions();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingUnderParent, setAddingUnderParent] = useState<string | null>(null); // null = not adding, ADD_AT_ROOT = at root, else folder id
  const [newFolderName, setNewFolderName] = useState("");

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
  const rootDiagrams = diagrams.filter((d) => !d.folderId);

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDragOverFolder(folderId);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const diagramId = e.dataTransfer.getData("application/x-archflow-diagram-id");
    if (diagramId) onDropOnFolder(folderId, diagramId);
    onDragLeave();
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-2 py-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pastas</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addFolderAtRoot} title="Nova pasta">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {/* Root drop target */}
        <div
          className={cn(
            "mx-1 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm",
            selectedFolderId === null && "bg-accent text-accent-foreground",
            dropTargetFolderId === null && "ring-1 ring-primary"
          )}
          onClick={() => onSelectFolder(null)}
          onDragOver={(e) => handleDragOver(e, null)}
          onDragLeave={onDragLeave}
          onDrop={(e) => handleDrop(e, null)}
        >
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">Raiz</span>
          {rootDiagrams.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{rootDiagrams.length}</span>
          )}
        </div>

        {addingUnderParent === ADD_AT_ROOT && (
          <div className="mx-1 mt-1 flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1">
            <Input
              placeholder="Nome da pasta…"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAddFolder();
                if (e.key === "Escape") setAddingUnderParent(null);
              }}
              onBlur={() => {
                if (newFolderName.trim()) submitAddFolder();
                else setAddingUnderParent(null);
              }}
              className="h-7 border-0 bg-transparent text-sm focus-visible:ring-0"
              autoFocus
            />
          </div>
        )}

        {rootFolders.map((folder) => (
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
      </div>
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
  const children = getChildFolders(folders, folder.id);
  const diagramCount = diagrams.filter((d) => d.folderId === folder.id).length;
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
    const diagramId = e.dataTransfer.getData("application/x-archflow-diagram-id");
    if (diagramId) onDropOnFolder(folder.id, diagramId);
    onDragLeave();
  };

  return (
    <div className="mt-0.5">
      <div
        className={cn(
          "group mx-1 flex cursor-pointer items-center gap-0.5 rounded-md py-1 pr-1 text-sm",
          isSelected && "bg-accent text-accent-foreground",
          isDropTarget && "ring-1 ring-primary",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => !isEditing && onSelectFolder(folder.id)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isEditing) startRename(folder);
        }}
        onDragOver={handleDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
      >
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(folder.id);
          }}
        >
          {children.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500/90" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-amber-500/90" />
        )}
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") setEditingId(null);
            }}
            onBlur={submitRename}
            onClick={(e) => e.stopPropagation()}
            className="h-6 flex-1 min-w-0 border border-border bg-background text-sm"
            autoFocus
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
        )}
        {!isEditing && (
          <>
            {diagramCount > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground">{diagramCount}</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => startRename(folder)}>Renomear</DropdownMenuItem>
                <DropdownMenuItem onClick={() => startAddSubfolder(folder.id)}>Nova subpasta</DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleDeleteFolder(folder.id)}
                >
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                startAddSubfolder(folder.id);
              }}
              title="Nova subpasta"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {isExpanded && (
        <>
          {addingUnderParent === folder.id && (
            <div
              className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1"
              style={{ marginLeft: `${8 + (depth + 1) * 16}px` }}
            >
              <Input
                placeholder="Nome da subpasta…"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAddFolder();
                  if (e.key === "Escape") setAddingUnderParent(null);
                }}
                onBlur={() => {
                  if (newFolderName.trim()) submitAddFolder();
                  else setAddingUnderParent(null);
                }}
                className="h-7 border-0 bg-transparent text-sm focus-visible:ring-0"
                autoFocus
              />
            </div>
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
        </>
      )}
    </div>
  );
}
