import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useActiveDiagram,
  useActiveDiagramId,
  useDiagramActions,
} from "@/features/diagram";

export interface DiagramDescriptionFieldProps {
  editLocked: boolean;
}

export function DiagramDescriptionField({ editLocked }: DiagramDescriptionFieldProps) {
  const { t } = useTranslation();
  const activeDiagramId = useActiveDiagramId();
  const diagram = useActiveDiagram();
  const { updateDiagramDescription } = useDiagramActions();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const skipSaveOnNextBlurRef = useRef(false);

  if (!diagram) return null;

  const handleStartEdit = () => {
    if (editLocked) return;
    setDraft(diagram.description ?? "");
    setIsEditing(true);
  };

  const handleSave = () => {
    if (activeDiagramId) {
      updateDiagramDescription(activeDiagramId, draft.trim());
    }
    setIsEditing(false);
  };

  const handleBlur = () => {
    if (skipSaveOnNextBlurRef.current) {
      skipSaveOnNextBlurRef.current = false;
      return;
    }
    handleSave();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      skipSaveOnNextBlurRef.current = true;
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={t("canvas.toolbar.descriptionPlaceholder")}
        className="bg-transparent outline-none"
        style={{
          fontSize: 12,
          color: "hsl(var(--muted-foreground))",
          border: "none",
          borderBottom: "1px solid hsl(var(--border))",
          width: "100%",
          maxWidth: 280,
          padding: "2px 0",
        }}
      />
    );
  }

  return (
    <span
      role={editLocked ? undefined : "button"}
      tabIndex={editLocked ? undefined : 0}
      onClick={handleStartEdit}
      onKeyDown={(event) => {
        if (editLocked) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleStartEdit();
        }
      }}
      title={
        editLocked
          ? t("diagramNav.unavailableWhileRecordingOrPlayback")
          : t("canvas.toolbar.editDescription")
      }
      className={
        editLocked
          ? "select-none opacity-80"
          : "cursor-text select-none hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-ring rounded-sm"
      }
      style={{
        fontSize: 12,
        color: diagram.description
          ? "hsl(var(--muted-foreground))"
          : "hsl(var(--muted-foreground) / 0.7)",
        maxWidth: 280,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        display: "block",
      }}
    >
      {diagram.description || t("canvas.toolbar.descriptionPlaceholder")}
    </span>
  );
}
