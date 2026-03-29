import { useState, useRef, useEffect, useMemo } from "react";
import { Layers } from "lucide-react";
import type { Diagram } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import { DiagramDescriptionField } from "../DiagramDescriptionField";
import { useTranslation } from "react-i18next";

export interface CanvasToolbarDiagramPanelProps {
  diagram: Diagram;
  toolbarEditLocked: boolean;
}

export function CanvasToolbarDiagramPanel({
  diagram,
  toolbarEditLocked,
}: CanvasToolbarDiagramPanelProps) {
  const { t } = useTranslation();
  const { updateDiagram } = useDiagramActions();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const levelLabels = useMemo(
    (): Record<string, string> => ({
      context: t("canvasToolbar.levelContext"),
      container: t("canvasToolbar.levelContainer"),
      component: t("canvasToolbar.levelComponent"),
      deployment: t("canvasToolbar.levelDeployment"),
    }),
    [t],
  );

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (toolbarEditLocked && isEditingName) {
      setEditNameValue(diagram.name);
      setIsEditingName(false);
    }
  }, [toolbarEditLocked, isEditingName, diagram]);

  const commitRename = () => {
    const trimmed = editNameValue.trim();
    if (trimmed && trimmed !== diagram.name) {
      updateDiagram(diagram.id, { name: trimmed });
    }
    setIsEditingName(false);
  };

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2">
      <div className="flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editNameValue}
            onChange={(e) => setEditNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setEditNameValue(diagram.name);
                setIsEditingName(false);
              }
            }}
            className="text-xs font-semibold bg-transparent border-b border-primary/50 outline-none min-w-[80px] max-w-[200px]"
          />
        ) : (
          <span
            onDoubleClick={() => {
              if (toolbarEditLocked) return;
              setEditNameValue(diagram.name);
              setIsEditingName(true);
            }}
            className={`text-xs font-semibold select-none ${toolbarEditLocked ? "cursor-default opacity-80" : "cursor-pointer hover:text-primary/80"}`}
            title={
              toolbarEditLocked
                ? t("diagramNav.unavailableWhileRecordingOrPlayback")
                : t("canvasToolbar.renameTitle")
            }
          >
            {diagram.name}
          </span>
        )}
        <span className="text-[10px] font-mono text-muted-foreground rounded bg-secondary px-1.5 py-0.5 shrink-0">
          {levelLabels[diagram.level]}
        </span>
      </div>
      <div className="min-w-0 pl-[22px]">
        <DiagramDescriptionField editLocked={toolbarEditLocked} />
      </div>
    </div>
  );
}
