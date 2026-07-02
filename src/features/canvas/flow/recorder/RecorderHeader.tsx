import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export interface RecorderHeaderProps {
  isEditing?: boolean;
  onCancel: () => void;
}

export function RecorderHeader({ isEditing, onCancel }: RecorderHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${isEditing ? "bg-amber-500" : "bg-red-500"} animate-pulse`}
        />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {isEditing ? t("flowRecorder.editingTitle") : t("flowRecorder.recordingTitle")}
        </h3>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
