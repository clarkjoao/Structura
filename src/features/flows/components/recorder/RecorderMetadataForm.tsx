import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { RecordingContext } from "../../state/flowMode.types";

export interface RecorderMetadataFormProps {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  participants: string[];
  recordingMode: RecordingContext["mode"];
  autoFocusName?: boolean;
}

export function RecorderMetadataForm({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  tags,
  onAddTag,
  onRemoveTag,
  participants,
  recordingMode,
  autoFocusName,
}: RecorderMetadataFormProps) {
  const { t } = useTranslation();

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value.trim()) {
      onAddTag(e.currentTarget.value.trim());
      e.currentTarget.value = "";
    }
  };

  return (
    <div className="p-3 space-y-3 shrink-0 border-b border-border">
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("flowRecorder.namePlaceholder")}
        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus={autoFocusName}
      />

      <input
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder={t("flowRecorder.descPlaceholder")}
        className="w-full rounded-md border border-border bg-secondary px-3 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          {t("flowRecorder.tags")}
        </p>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 text-[9px] rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground"
            >
              {tag}
              <button type="button" onClick={() => onRemoveTag(i)} className="hover:text-destructive ml-0.5">
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          placeholder={t("flowRecorder.tagPlaceholder")}
          className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={handleTagKey}
        />
      </div>

      {participants.length > 0 && recordingMode !== "branch-select" && (
        <p className="text-[10px] text-muted-foreground">{participants.join(", ")}</p>
      )}
    </div>
  );
}
