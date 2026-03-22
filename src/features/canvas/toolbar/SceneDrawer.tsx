import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Copy,
  GitBranch,
  GitMerge,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  computeMergePreview,
  sceneHasDiff,
  useActiveDiagram,
  useDiagramActions,
  type MergePreview,
  type SceneDiff,
} from "@/features/diagram";
import { cn } from "@/lib/utils";
import { MergeSceneDialog } from "./MergeSceneDialog";

export type SceneDrawerScene = SceneDiff;

export interface SceneDrawerProps {
  scenes: SceneDrawerScene[];
  activeSceneId: string | null;
  compareSceneId: string | null;
  onClose: () => void;
  onSelectScene: (id: string) => void;
  onAddScene: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMerge: (scene: SceneDiff) => void;
  onSelectBase: () => void;
}

function SceneRow({
  scene,
  isActive,
  isCompare,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onMerge,
}: {
  scene: SceneDrawerScene;
  isActive: boolean;
  isCompare: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMerge: () => void;
}) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);
  const hasDiff = sceneHasDiff(scene);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : isCompare
            ? "border border-dashed border-border bg-muted/30 hover:bg-surface-hover text-foreground"
            : "hover:bg-surface-hover text-foreground",
      )}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={cn(
          "w-2.5 h-2.5 rounded-full shrink-0 transition-transform",
          isActive ? "scale-125" : "",
        )}
        style={{ backgroundColor: scene.color }}
      />

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{scene.name}</p>
      </div>

      {isCompare && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
          ≠
        </span>
      )}

      {isActive && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-primary shrink-0">
          {t("scenes.drawerActiveBadge")}
        </span>
      )}

      {showActions && (
        <div
          className="flex items-center gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onRename}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={t("scenes.rename")}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={t("scenes.duplicate")}
          >
            <Copy className="h-3 w-3" />
          </button>
          {hasDiff && (
            <button
              type="button"
              onClick={onMerge}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={t("scenes.mergeIntoBase")}
            >
              <GitMerge className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
            title={hasDiff ? t("scenes.remove") : t("scenes.deleteEmptyScene")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function SceneDrawer({
  scenes,
  activeSceneId,
  compareSceneId,
  onClose,
  onSelectScene,
  onAddScene,
  onRename,
  onDuplicate,
  onDelete,
  onMerge,
  onSelectBase,
}: SceneDrawerProps) {
  const { t } = useTranslation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [mergeDialog, setMergeDialog] = useState<{
    scene: SceneDiff;
    preview: MergePreview;
  } | null>(null);

  const diagram = useActiveDiagram();

  const commitRename = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) onRename(id, trimmed);
    setRenamingId(null);
    setRenameDraft("");
  };

  const openMergeDialog = (sc: SceneDiff) => {
    if (!diagram) return;
    try {
      const preview = computeMergePreview(diagram, sc.id);
      setMergeDialog({ scene: sc, preview });
    } catch {
      toast.error(t("scenes.mergePreviewError"));
    }
  };

  return (
    <>
      <div
        className="absolute inset-0 z-20 bg-background/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        className="absolute top-14 left-4 z-30 w-[420px] rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in-0 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("scenes.drawerTitle")}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">
              {t("scenes.drawerTitle")}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {t("scenes.drawerSceneCount", { count: scenes.length })}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-hover"
            aria-label={t("canvasSearch.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-2 space-y-0.5 max-h-[320px] overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onSelectBase();
              onClose();
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 w-full text-left transition-colors",
              activeSceneId === null && !compareSceneId
                ? "bg-primary/10 text-primary"
                : "hover:bg-surface-hover text-foreground",
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/40" />
            <span className="text-xs font-medium">{t("scenes.base")}</span>
            {activeSceneId === null && !compareSceneId && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary ml-auto">
                {t("scenes.drawerActiveBadge")}
              </span>
            )}
          </button>

          {scenes.map((scene) =>
            renamingId === scene.id ? (
              <div key={scene.id} className="px-2 py-1">
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(scene.id);
                    if (e.key === "Escape") {
                      setRenamingId(null);
                      setRenameDraft("");
                    }
                  }}
                  onBlur={() => commitRename(scene.id)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs"
                />
              </div>
            ) : (
              <SceneRow
                key={scene.id}
                scene={scene}
                isActive={scene.id === activeSceneId}
                isCompare={scene.id === compareSceneId}
                onSelect={() => {
                  onSelectScene(scene.id);
                  onClose();
                }}
                onRename={() => {
                  setRenamingId(scene.id);
                  setRenameDraft(scene.name);
                }}
                onDuplicate={() => onDuplicate(scene.id)}
                onDelete={() => onDelete(scene.id)}
                onMerge={() => openMergeDialog(scene)}
              />
            ),
          )}
        </div>

        <div className="border-t border-border p-2">
          {newOpen ? (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onAddScene(newName.trim());
                  setNewName("");
                  setNewOpen(false);
                }
                if (e.key === "Escape") {
                  setNewName("");
                  setNewOpen(false);
                }
              }}
              onBlur={() => {
                setNewName("");
                setNewOpen(false);
              }}
              placeholder={t("scenes.newNamePlaceholder")}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewOpen(true);
              }}
              className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("scenes.newScene")}
            </button>
          )}
        </div>
      </div>

      {mergeDialog && diagram && (
        <MergeSceneDialog
          open
          onOpenChange={(open) => {
            if (!open) setMergeDialog(null);
          }}
          diagram={diagram}
          scene={mergeDialog.scene}
          preview={mergeDialog.preview}
          onConfirm={() => {
            if (!mergeDialog) return;
            const { scene, preview } = mergeDialog;
            const conflictCount = preview.conflicts.length;
            onMerge(scene);
            setMergeDialog(null);
            toast.success(t("scenes.mergeSuccess", { name: scene.name }), {
              description:
                conflictCount > 0
                  ? t("scenes.mergeSuccessConflicts", { count: conflictCount })
                  : undefined,
            });
          }}
          onCancel={() => setMergeDialog(null)}
        />
      )}
    </>
  );
}

export function ConnectedSceneDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const {
    addScene,
    removeScene,
    setActiveScene,
    setCompareScene,
    renameScene,
    mergeSceneIntoBase,
    duplicateScene,
  } = useDiagramActions();

  if (!diagram) return null;

  const sceneRecord = diagram.scenes ?? {};
  const scenes = Object.values(sceneRecord).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const activeId =
    diagram.activeSceneId && sceneRecord[diagram.activeSceneId]
      ? diagram.activeSceneId
      : null;
  const compareId =
    diagram.compareSceneId && sceneRecord[diagram.compareSceneId]
      ? diagram.compareSceneId
      : null;

  const handleScenePillClick = (sceneId: string) => {
    if (activeId === null) {
      setActiveScene(sceneId);
      return;
    }
    if (activeId === sceneId) {
      setActiveScene(null);
      setCompareScene(null);
      return;
    }
    if (compareId === sceneId) {
      setCompareScene(null);
      return;
    }
    if (compareId === null) {
      setCompareScene(sceneId);
      return;
    }
    setCompareScene(sceneId);
  };

  const handleDeleteEmptyScene = (sc: SceneDiff) => {
    removeScene(sc.id);
    toast.success(t("scenes.emptySceneDeleted", { name: sc.name }));
  };

  return (
    <SceneDrawer
      scenes={scenes}
      activeSceneId={activeId}
      compareSceneId={compareId}
      onClose={onClose}
      onSelectScene={(id) => handleScenePillClick(id)}
      onAddScene={(trimmed) => {
        const name = trimmed.trim() || t("scenes.defaultSceneName");
        const created = addScene(name);
        setActiveScene(created.id);
      }}
      onRename={(id, name) => renameScene(id, name)}
      onDuplicate={(id) => {
        const src = sceneRecord[id];
        const dupName = t("scenes.duplicatedSceneName", { name: src?.name ?? "" });
        const created = duplicateScene(id, dupName);
        if (created) {
          setActiveScene(created.id);
          toast.success(t("scenes.duplicateSuccess", { name: created.name }));
        }
      }}
      onDelete={(id) => {
        const sc = sceneRecord[id];
        if (!sc) return;
        if (sceneHasDiff(sc)) {
          removeScene(sc.id);
        } else {
          handleDeleteEmptyScene(sc);
        }
      }}
      onMerge={(scene) => {
        mergeSceneIntoBase(scene.id);
      }}
      onSelectBase={() => {
        setActiveScene(null);
        setCompareScene(null);
      }}
    />
  );
}
