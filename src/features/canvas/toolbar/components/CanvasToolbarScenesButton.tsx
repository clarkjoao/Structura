import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";

export interface CanvasToolbarScenesButtonProps {
  diagram: Diagram;
  scenesPickerLocked: boolean;
  onOpenScenes?: () => void;
}

export function CanvasToolbarScenesButton({
  diagram,
  scenesPickerLocked,
  onOpenScenes,
}: CanvasToolbarScenesButtonProps) {
  const { t } = useTranslation();
  const sceneRecord = diagram.scenes ?? {};
  const activeScene =
    diagram.activeSceneId && sceneRecord[diagram.activeSceneId]
      ? sceneRecord[diagram.activeSceneId]
      : null;

  if (!onOpenScenes) return null;

  if (activeScene) {
    return (
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
        className={`flex items-center gap-1 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors ${scenesPickerLocked ? "opacity-50 pointer-events-none" : ""}`}
      >
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: activeScene.color }}
        />
        <span className="truncate">{activeScene.name}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={scenesPickerLocked}
      onClick={() => {
        if (scenesPickerLocked) return;
        onOpenScenes();
      }}
      className={`flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors ${scenesPickerLocked ? "opacity-50 pointer-events-none" : ""}`}
      title={
        scenesPickerLocked
          ? t("diagramNav.unavailableWhileRecordingOrPlayback")
          : t("scenes.viewVersionsTitle")
      }
    >
      <GitBranch className="h-3.5 w-3.5 shrink-0" />
      {t("scenes.viewVersionsTitle")}
    </button>
  );
}
