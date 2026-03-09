import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Layers, Clock, Network, Trash2, FolderOpen, MoreHorizontal } from "lucide-react";
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

const levelLabels: Record<string, string> = {
  context: "Level 1",
  container: "Level 2",
  component: "Level 3",
};

type SortKey = "name" | "domain" | "level" | "updatedAt";

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
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [triggerAddFolder, setTriggerAddFolder] = useState(0);
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

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " ↑" : " ↓";
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent, diagramId: string) => {
      e.dataTransfer.setData("application/x-archflow-diagram-id", diagramId);
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

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Tree sidebar */}
        <div ref={folderTreeRef} className="w-56 shrink-0 overflow-hidden">
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

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="border-b border-border bg-card px-4 py-3">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    asChild
                    onClick={() => setSelectedFolderId(null)}
                    className="cursor-pointer"
                  >
                    <button type="button">Raiz</button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbPath.map((folder) => (
                  <BreadcrumbItem key={folder.id}>
                    <BreadcrumbSeparator />
                    <BreadcrumbLink
                      asChild
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="cursor-pointer"
                    >
                      <button type="button">{folder.name}</button>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                ))}
                {selectedFolderId && breadcrumbPath.length > 0 && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {folders[selectedFolderId]?.name ?? "—"}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {selectedFolderId
                  ? folders[selectedFolderId]?.name ?? "—"
                  : "Raiz"}
              </h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Novo diagrama
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setTriggerAddFolder((t) => t + 1)}
                  className="inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Nova pasta
                </Button>
              </div>
            </div>

            {/* Folder cards */}
            {childFolders.length > 0 && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {childFolders.map((folder) => {
                  const subCount = Object.values(folders).filter(
                    (f) => f.parentId === folder.id,
                  ).length;
                  const diagCount = diagrams.filter(
                    (d) => d.folderId === folder.id,
                  ).length;
                  const total = subCount + diagCount;
                  return (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                        <FolderOpen className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {total} {total === 1 ? "item" : "itens"}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolderId(folder.id);
                            }}
                          >
                            Abrir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Diagram table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="w-10 px-4 py-3" />
                    <th
                      onClick={() => handleSort("name")}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Nome{sortIcon("name")}
                    </th>
                    <th
                      onClick={() => handleSort("domain")}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Domínio{sortIcon("domain")}
                    </th>
                    <th
                      onClick={() => handleSort("level")}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Nível C4{sortIcon("level")}
                    </th>
                    <th
                      onClick={() => handleSort("updatedAt")}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Última edição{sortIcon("updatedAt")}
                    </th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((d) => (
                    <tr
                      key={d.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, d.id)}
                      onClick={() => handleOpen(d)}
                      className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/10">
                          <Network className="h-4 w-4 text-primary" />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {d.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.domain ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                          {levelLabels[d.level]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> {d.updatedAt}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => handleDelete(e, d.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        {childFolders.length === 0
                          ? "Nenhum diagrama nesta pasta. Crie o primeiro!"
                          : "Nenhum diagrama nesta pasta."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground bg-secondary/30">
                {folderDiagrams.length} diagrama
                {folderDiagrams.length !== 1 ? "s" : ""} nesta pasta
              </div>
            </div>
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

const AddDiagramDialog = ({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, level: Level, domain?: string) => void;
}) => {
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
        <h3 className="text-lg font-bold mb-4">Novo diagrama</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              Nome
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex.: System Context"
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              Nível C4
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="context">Nível 1 – Contexto de sistema</option>
              <option value="container">Nível 2 – Container</option>
              <option value="component">Nível 3 – Componente</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              Domínio (opcional)
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="ex.: E-commerce"
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md border border-border transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (name.trim()) onAdd(name.trim(), level, domain.trim() || undefined);
            }}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Criar diagrama
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
