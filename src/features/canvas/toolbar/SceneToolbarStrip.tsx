import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Plus } from "lucide-react";
import { useActiveDiagram, useDiagramActions } from "@/features/diagram";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function SceneToolbarStrip() {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const { addScene, removeScene, setActiveScene, renameScene } = useDiagramActions();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

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

  const pillClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors max-w-[140px]",
      active
        ? "border-primary bg-primary/10 text-foreground"
        : "border-border bg-card/90 text-muted-foreground hover:text-foreground hover:bg-surface-hover",
    );

  const commitRename = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) renameScene(id, trimmed);
    setRenamingId(null);
    setRenameDraft("");
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[min(100vw-2rem,480px)]">
      <button
        type="button"
        onClick={() => setActiveScene(null)}
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
              onClick={() => setActiveScene(activeId === sc.id ? null : sc.id)}
              className={pillClass(activeId === sc.id)}
              title={sc.name}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: sc.color }}
                aria-hidden
              />
              <span className="truncate">{sc.name}</span>
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
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => {
                  setRenamingId(sc.id);
                  setRenameDraft(sc.name);
                }}
              >
                {t("scenes.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => removeScene(sc.id)}
              >
                {t("scenes.remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

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
