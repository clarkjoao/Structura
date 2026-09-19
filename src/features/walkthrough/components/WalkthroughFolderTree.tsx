import { useState, useCallback, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder as FolderIcon,
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
import { useDiagramActions, type Folder } from "@/features/diagram";
import { useTranslation } from "react-i18next";

interface Props {
  folders: Record<string, Folder>;
  /** Map of folderId → walkthrough count under that folder. `null` = unfiled / root. */
  countByFolderId: Map<string | null, number>;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  /** Bumped to programmatically open the "new folder at root" editor. */
  triggerAddFolderAtRoot?: number;
}

const ADD_AT_ROOT = "__add_at_root__";

function getChildFolders(folders: Record<string, Folder>, parentId: string | null): Folder[] {
  return Object.values(folders)
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function WalkthroughFolderTree({
  folders,
  countByFolderId,
  selectedFolderId,
  onSelectFolder,
  triggerAddFolderAtRoot = 0,
}: Props) {
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

  const startRename = useCallback((folder: Folder) => {
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
    if (!newFolderName.trim()) return;
    const parentId = addingUnderParent === ADD_AT_ROOT ? null : addingUnderParent;
    const created = addFolder(newFolderName.trim(), parentId);
    if (addingUnderParent && addingUnderParent !== ADD_AT_ROOT) {
      setExpandedIds((p) => new Set(p).add(addingUnderParent));
    }
    setAddingUnderParent(null);
    setNewFolderName("");
    onSelectFolder(created.id);
  }, [newFolderName, addingUnderParent, addFolder, onSelectFolder]);

  const handleDeleteFolder = useCallback(
    (id: string) => {
      deleteFolder(id);
      if (selectedFolderId === id) onSelectFolder(null);
    },
    [deleteFolder, selectedFolderId, onSelectFolder],
  );

  const rootFolders = getChildFolders(folders, null);
  const totalWalkthroughs = Array.from(countByFolderId.values()).reduce(
    (a, b) => a + b,
    0,
  );

  const filteredRootFolders = searchQuery.trim()
    ? rootFolders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : rootFolders;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center px-3 pb-1 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/60">
          {t("walkthrough.folderTree.title", "Walkthroughs")}
        </span>
      </div>

      <div className="px-2 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/30" />
          <Input
            placeholder={t("folderTree.searchFoldersPlaceholder", "Search folders")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 border-0 bg-sidebar-accent/50 pl-7 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus-visible:ring-1 focus-visible:ring-sidebar-ring/50"
          />
        </div>
        <Button
          variant="default"
          size="sm"
          className="mt-1.5 h-8 w-full justify-start gap-1.5"
          onClick={addFolderAtRoot}
          title={t("folderTree.newFolderTitle", "New folder")}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("folderTree.newFolder", "New folder")}
        </Button>
      </div>

      <div
        className="flex-1 space-y-0.5 overflow-y-auto px-1.5 py-1"
        onKeyDown={(e) => {
          if (keyIs(e, KEY.ENTER)) {
            if (addingUnderParent !== null) submitAddFolder();
          }
          if (e.key === "Escape") {
            if (addingUnderParent !== null) {
              setAddingUnderParent(null);
              setNewFolderName("");
            } else if (editingId) {
              setEditingId(null);
              setEditName("");
            }
          }
        }}
      >
        {/* Root row: "All walkthroughs" */}
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
            selectedFolderId === null
              ? "bg-accent font-semibold text-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <Home className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">
            {t("walkthrough.folderTree.all", "All walkthroughs")}
          </span>
          <span className="text-[11px] tabular-nums text-sidebar-foreground/50">
            {totalWalkthroughs}
          </span>
        </button>

        {/* Root-level new folder inline editor */}
        {addingUnderParent === ADD_AT_ROOT && (
          <FolderInlineEditor
            value={newFolderName}
            onChange={setNewFolderName}
            onSubmit={submitAddFolder}
            onCancel={() => {
              setAddingUnderParent(null);
              setNewFolderName("");
            }}
          />
        )}

        {/* Folder tree */}
        {filteredRootFolders.map((folder) => (
          <FolderNode
            key={folder.id}
            folder={folder}
            depth={1}
            folders={folders}
            countByFolderId={countByFolderId}
            expandedIds={expandedIds}
            onToggle={toggleExpand}
            selectedFolderId={selectedFolderId}
            onSelect={onSelectFolder}
            editingId={editingId}
            editName={editName}
            onEditNameChange={setEditName}
            onSubmitRename={submitRename}
            onStartRename={startRename}
            onCancelRename={() => {
              setEditingId(null);
              setEditName("");
            }}
            onDelete={handleDeleteFolder}
            onAddSubfolder={startAddSubfolder}
            addingUnderParent={addingUnderParent}
            newFolderName={newFolderName}
            onNewFolderNameChange={setNewFolderName}
            onSubmitNewFolder={submitAddFolder}
            onCancelNewFolder={() => {
              setAddingUnderParent(null);
              setNewFolderName("");
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface FolderNodeProps {
  folder: Folder;
  depth: number;
  folders: Record<string, Folder>;
  countByFolderId: Map<string | null, number>;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  selectedFolderId: string | null;
  onSelect: (id: string) => void;
  editingId: string | null;
  editName: string;
  onEditNameChange: (v: string) => void;
  onSubmitRename: () => void;
  onStartRename: (f: Folder) => void;
  onCancelRename: () => void;
  onDelete: (id: string) => void;
  onAddSubfolder: (parentId: string) => void;
  addingUnderParent: string | null;
  newFolderName: string;
  onNewFolderNameChange: (v: string) => void;
  onSubmitNewFolder: () => void;
  onCancelNewFolder: () => void;
}

function FolderNode({
  folder,
  depth,
  folders,
  countByFolderId,
  expandedIds,
  onToggle,
  selectedFolderId,
  onSelect,
  editingId,
  editName,
  onEditNameChange,
  onSubmitRename,
  onStartRename,
  onCancelRename,
  onDelete,
  onAddSubfolder,
  addingUnderParent,
  newFolderName,
  onNewFolderNameChange,
  onSubmitNewFolder,
  onCancelNewFolder,
}: FolderNodeProps) {
  const children = getChildFolders(folders, folder.id);
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const count = countByFolderId.get(folder.id) ?? 0;
  const isEditing = editingId === folder.id;
  const isAddingChild = addingUnderParent === folder.id;

  return (
    <div>
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md px-1 py-1 text-[13px] transition-colors",
          isSelected
            ? "bg-accent font-semibold text-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          className="flex shrink-0 items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(folder.id);
          }}
        >
          {children.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="block h-3.5 w-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className="flex flex-1 items-center gap-1.5 truncate text-left"
        >
          {isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <FolderIcon className="h-3.5 w-3.5 shrink-0" />
          )}
          {isEditing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") onSubmitRename();
                if (e.key === "Escape") onCancelRename();
              }}
              onBlur={onSubmitRename}
              className="flex-1 rounded-sm bg-background px-1 py-0.5 text-xs text-foreground outline-none ring-1 ring-ring"
            />
          ) : (
            <span className="flex-1 truncate">{folder.name}</span>
          )}
        </button>

        <span className="shrink-0 text-[11px] tabular-nums text-sidebar-foreground/50">
          {count}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-sidebar-accent group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => onAddSubfolder(folder.id)}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              New subfolder
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onStartRename(folder)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onDelete(folder.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div>
          {isAddingChild && (
            <FolderInlineEditor
              value={newFolderName}
              onChange={onNewFolderNameChange}
              onSubmit={onSubmitNewFolder}
              onCancel={onCancelNewFolder}
              depth={depth + 1}
            />
          )}
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              folders={folders}
              countByFolderId={countByFolderId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              editingId={editingId}
              editName={editName}
              onEditNameChange={onEditNameChange}
              onSubmitRename={onSubmitRename}
              onStartRename={onStartRename}
              onCancelRename={onCancelRename}
              onDelete={onDelete}
              onAddSubfolder={onAddSubfolder}
              addingUnderParent={addingUnderParent}
              newFolderName={newFolderName}
              onNewFolderNameChange={onNewFolderNameChange}
              onSubmitNewFolder={onSubmitNewFolder}
              onCancelNewFolder={onCancelNewFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FolderInlineEditorProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  depth?: number;
}

function FolderInlineEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  depth = 1,
}: FolderInlineEditorProps) {
  return (
    <div className="px-1 py-1" style={{ paddingLeft: `${depth * 12}px` }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onCancel}
        placeholder="Folder name"
        className="w-full rounded-sm bg-background px-1.5 py-1 text-xs text-foreground outline-none ring-1 ring-ring"
      />
    </div>
  );
}
