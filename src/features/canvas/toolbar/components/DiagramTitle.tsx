import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp } from "lucide-react";
import { useDiagramActions, type Diagram } from "@/features/diagram";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { cn } from "@/lib/utils";

export interface DiagramTitleProps {
  diagram: Diagram;
  /** Renaming is refused while the canvas cannot be edited. */
  editLocked: boolean;
  /** Back to the diagram this one was drilled into from, when there is one. */
  onDrillUp?: () => void;
}

/**
 * The diagram's name, C4 level and description, in the page header: rename
 * with a double-click, go up a level from the arrow beside it.
 */
export function DiagramTitle({ diagram, editLocked, onDrillUp }: DiagramTitleProps) {
  const { t } = useTranslation();
  const { updateDiagram } = useDiagramActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const levelLabel = useMemo(
    () =>
      ({
        context: t("canvasToolbar.levelContext"),
        container: t("canvasToolbar.levelContainer"),
        component: t("canvasToolbar.levelComponent"),
        deployment: t("canvasToolbar.levelDeployment"),
      })[diagram.level],
    [t, diagram.level],
  );

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (editLocked) setEditing(false);
  }, [editLocked]);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== diagram.name) updateDiagram(diagram.id, { name });
    setEditing(false);
  };

  const description = diagram.description?.trim();

  return (
    <div className="flex min-w-0 items-center gap-2">
      {onDrillUp && (
        <button
          type="button"
          onClick={onDrillUp}
          title={t("canvasToolbar.drillUp")}
          aria-label={t("canvasToolbar.drillUp")}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronUp aria-hidden className="h-4 w-4" />
        </button>
      )}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          aria-label={t("canvasToolbar.renameDiagram")}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (keyIs(event, KEY.ENTER)) commit();
            if (keyIs(event, KEY.ESCAPE)) setEditing(false);
          }}
          className="min-w-0 rounded border border-primary/50 bg-transparent px-1 text-sm font-medium outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => {
            if (editLocked) return;
            setDraft(diagram.name);
            setEditing(true);
          }}
          title={editLocked ? diagram.name : t("canvasToolbar.renameDiagramHint")}
          className={cn("truncate font-medium", !editLocked && "cursor-text hover:text-primary/80")}
        >
          {diagram.name}
        </span>
      )}
      {levelLabel && (
        <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {levelLabel}
        </span>
      )}
      {description && (
        <span
          title={description}
          className="hidden min-w-0 max-w-[24rem] truncate text-xs text-muted-foreground lg:inline"
        >
          {description}
        </span>
      )}
    </div>
  );
}
