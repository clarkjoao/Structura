import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";

export interface CanvasToolbarVersionsButtonProps {
  diagram: Diagram;
  versionsPickerLocked: boolean;
  onOpenVersions?: () => void;
}

export function CanvasToolbarVersionsButton({
  diagram,
  versionsPickerLocked,
  onOpenVersions,
}: CanvasToolbarVersionsButtonProps) {
  const { t } = useTranslation();
  const sceneRecord = diagram.versions ?? {};
  const activeVersion =
    diagram.activeVersionId && sceneRecord[diagram.activeVersionId]
      ? sceneRecord[diagram.activeVersionId]
      : null;

  if (!onOpenVersions) return null;

  if (activeVersion) {
    return (
      <button
        type="button"
        disabled={versionsPickerLocked}
        onClick={() => {
          if (versionsPickerLocked) return;
          onOpenVersions();
        }}
        title={
          versionsPickerLocked ? t("diagramNav.unavailableWhileRecordingOrPlayback") : undefined
        }
        className={`flex items-center gap-1 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors ${versionsPickerLocked ? "opacity-50 pointer-events-none" : ""}`}
      >
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: activeVersion.color }}
        />
        <span className="truncate">{activeVersion.name}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={versionsPickerLocked}
      onClick={() => {
        if (versionsPickerLocked) return;
        onOpenVersions();
      }}
      className={`flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors ${versionsPickerLocked ? "opacity-50 pointer-events-none" : ""}`}
      title={
        versionsPickerLocked
          ? t("diagramNav.unavailableWhileRecordingOrPlayback")
          : t("versions.viewVersionsTitle")
      }
    >
      <GitBranch className="h-3.5 w-3.5 shrink-0" />
      {t("versions.viewVersionsTitle")}
    </button>
  );
}
