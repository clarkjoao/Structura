import { useState, useRef, useEffect, useMemo } from "react";
import { Layers, GitBranch } from "lucide-react";
import type { Diagram } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import { DiagramDescriptionField } from "../DiagramDescriptionField";
import { useTranslation } from "react-i18next";

export interface CanvasToolbarDiagramPanelProps {
  diagram: Diagram;
  toolbarEditLocked: boolean;
  scenesPickerLocked: boolean;
  onOpenScenes?: () => void;
  selectedCount: number;
}

export function CanvasToolbarDiagramPanel({
  diagram,
  toolbarEditLocked,
  scenesPickerLocked,
  onOpenScenes,
  selectedCount,
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

  const sceneRecord = diagram.scenes ?? {};
  const activeScene =
    diagram.activeSceneId && sceneRecord[diagram.activeSceneId]
      ? sceneRecord[diagram.activeSceneId]
      : null;

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
        {onOpenScenes &&
          (activeScene ? (
            <button
              type="button"
              disabled={scenesPickerLocked}
              onClick={() => {
                if (scenesPickerLocked) return;
                onOpenScenes();
              }}
              title={
                scenesPickerLocked
                  ? t("diagramNav.unavailableWhileRecordingOrPlayback")
                  : undefined
              }
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-border bg-secondary hover:bg-surface-hover transition-colors shrink-0 max-w-[140px] ${scenesPickerLocked ? "opacity-50 pointer-events-none" : ""}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: activeScene.color }}
              />
              <span className="truncate">{activeScene.name}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={scenesPickerLocked}
              onClick={() => {
                if (scenesPickerLocked) return;
                onOpenScenes();
              }}
              className={`text-[10px] text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded shrink-0 ${scenesPickerLocked ? "opacity-50 pointer-events-none" : ""}`}
              title={
                scenesPickerLocked
                  ? t("diagramNav.unavailableWhileRecordingOrPlayback")
                  : t("scenes.viewVersionsTitle")
              }
            >
              <GitBranch className="h-3 w-3" />
            </button>
          ))}
        {selectedCount > 1 && (
          <span className="text-xs text-muted-foreground ml-1">
            {t("canvasToolbar.selectedCount", { count: selectedCount })}
          </span>
        )}
      </div>
      <div className="min-w-0 pl-[22px]">
        <DiagramDescriptionField editLocked={toolbarEditLocked} />
      </div>
    </div>
  );
}
