import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Circle, MoreHorizontal, Plus, X } from "lucide-react";
import {
  computeMergePreview,
  sceneHasDiff,
  useActiveDiagram,
  useDiagramActions,
  type MergePreview,
  type SceneDiff,
} from "@/features/diagram";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MergeSceneDialog } from "./MergeSceneDialog";

export function SceneToolbarStrip() {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const {
    addScene,
    removeScene,
    setActiveScene,
    renameScene,
    setCompareScene,
    mergeSceneIntoBase,
  } = useDiagramActions();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [mergeDialog, setMergeDialog] = useState<{
    scene: SceneDiff;
    preview: MergePreview;
  } | null>(null);

  if (!diagram) {
    return null;
  }

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
  const isCompareModeUi = activeId !== null && compareId !== null;

  const pillClass = (active: boolean, opts?: { dashed?: boolean }) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors max-w-[140px]",
      opts?.dashed && "border-dashed",
      active
        ? "border-primary bg-primary/10 text-foreground"
        : "border-border bg-card/90 text-muted-foreground hover:text-foreground hover:bg-surface-hover",
    );

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

  const commitRename = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) renameScene(id, trimmed);
    setRenamingId(null);
    setRenameDraft("");
  };

  const openMergeDialog = (sc: SceneDiff) => {
    try {
      const preview = computeMergePreview(diagram, sc.id);
      setMergeDialog({ scene: sc, preview });
    } catch {
      toast.error(t("scenes.mergePreviewError"));
    }
  };

  const handleMergeConfirm = () => {
    if (!mergeDialog) return;
    const { scene, preview } = mergeDialog;
    const conflictCount = preview.conflicts.length;
    mergeSceneIntoBase(scene.id);
    toast.success(t("scenes.mergeSuccess", { name: scene.name }), {
      description:
        conflictCount > 0 ? t("scenes.mergeSuccessConflicts", { count: conflictCount }) : undefined,
    });
  };

  const handleDeleteEmptyScene = (sc: SceneDiff) => {
    removeScene(sc.id);
    toast.success(t("scenes.emptySceneDeleted", { name: sc.name }));
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[min(100vw-2rem,480px)]">
      {isCompareModeUi && (
        <span
          className="mr-1 border-r border-border px-2 text-[10px] font-medium text-muted-foreground"
          aria-live="polite"
        >
          {t("scenes.comparing")}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          setActiveScene(null);
          setCompareScene(null);
        }}
        className={pillClass(activeId === null)}
      >
        {t("scenes.base")}
      </button>

      {scenes.map((sc) => (
        <div key={sc.id} className="flex items-center gap-0.5">
          {renamingId === sc.id ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(sc.id);
                if (e.key === "Escape") {
                  setRenamingId(null);
                  setRenameDraft("");
                }
              }}
              onBlur={() => commitRename(sc.id)}
              className="h-6 w-[100px] rounded-full border border-border bg-background px-2 text-[10px]"
            />
          ) : (
            <button
              type="button"
              onClick={() => handleScenePillClick(sc.id)}
              className={pillClass(
                activeId === sc.id || compareId === sc.id,
                { dashed: isCompareModeUi && compareId === sc.id },
              )}
              title={sc.name}
            >
              {isCompareModeUi && activeId === sc.id ? (
                <Circle
                  className="h-2 w-2 shrink-0 fill-primary text-primary"
                  aria-hidden
                />
              ) : isCompareModeUi && compareId === sc.id ? (
                <span className="shrink-0 text-[11px] font-bold leading-none" aria-hidden>
                  ≠
                </span>
              ) : (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: sc.color }}
                  aria-hidden
                />
              )}
              <span className="truncate">{sc.name}</span>
              {isCompareModeUi && activeId === sc.id && (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-0.5 shrink-0 rounded p-0.5 hover:bg-primary/20"
                  title={t("scenes.clearSceneAndCompare")}
                  aria-label={t("scenes.clearSceneAndCompare")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveScene(null);
                    setCompareScene(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveScene(null);
                      setCompareScene(null);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              {isCompareModeUi && compareId === sc.id && (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-0.5 shrink-0 rounded p-0.5 hover:bg-muted"
                  title={t("scenes.removeFromCompare")}
                  aria-label={t("scenes.removeFromCompare")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCompareScene(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setCompareScene(null);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                aria-label={t("scenes.sceneMenu")}
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  setRenamingId(sc.id);
                  setRenameDraft(sc.name);
                }}
              >
                {t("scenes.rename")}
              </DropdownMenuItem>
              {sceneHasDiff(sc) ? (
                <DropdownMenuItem onClick={() => openMergeDialog(sc)}>
                  {t("scenes.mergeIntoBase")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleDeleteEmptyScene(sc)}>
                  {t("scenes.deleteEmptyScene")}
                </DropdownMenuItem>
              )}
              {sceneHasDiff(sc) && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => removeScene(sc.id)}
                >
                  {t("scenes.remove")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      {mergeDialog && (
        <MergeSceneDialog
          open
          onOpenChange={(open) => {
            if (!open) setMergeDialog(null);
          }}
          diagram={diagram}
          scene={mergeDialog.scene}
          preview={mergeDialog.preview}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeDialog(null)}
        />
      )}

      {newOpen ? (
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const name = newName.trim() || t("scenes.defaultSceneName");
              const created = addScene(name);
              setActiveScene(created.id);
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
          className="h-6 w-[120px] rounded-full border border-border bg-background px-2 text-[10px]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className={pillClass(false)}
        >
          <Plus className="h-3 w-3 shrink-0" />
          {t("scenes.newScene")}
        </button>
      )}
    </div>
  );
}
