import { useTranslation } from "react-i18next";
import { Code2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecorderHeaderProps {
  isEditing?: boolean;
  onCancel: () => void;
  mermaidVisible: boolean;
  onToggleMermaid: () => void;
}

export function RecorderHeader({ isEditing, onCancel, mermaidVisible, onToggleMermaid }: RecorderHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isEditing ? "bg-amber-500" : "bg-red-500"} animate-pulse`} />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {isEditing ? t("flowRecorder.editingTitle") : t("flowRecorder.recordingTitle")}
        </h3>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleMermaid}
          title={t("flowRecorder.toggleMermaid")}
          aria-label={t("flowRecorder.toggleMermaid")}
          aria-pressed={mermaidVisible}
          className={cn(
            "rounded p-0.5 transition-colors",
            mermaidVisible ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Code2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground rounded p-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
