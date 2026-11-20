import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { PanelSection } from "../../panels/ElementPanel/shell/PanelSection";
import { PANEL_INPUT_CLASS, PANEL_LABEL_CLASS } from "../../panels/ElementPanel/shell/fieldStyles";

/**
 * Everything about a flow except its name, folded into one section.
 *
 * These fields are written once and then sat above the script forever, taking
 * room from the thing the panel is for. The name lives in the panel header — it
 * is the one field that is required, the one shown wherever else the flow
 * appears, and the one a new recording opens focused on.
 */

export interface RecorderMetadataFormProps {
  description: string;
  onDescriptionChange: (desc: string) => void;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  participants: string[];
  /** Open for a new recording, where nothing has been written yet. */
  defaultDetailsOpen?: boolean;
}

export function RecorderMetadataForm({
  description,
  onDescriptionChange,
  tags,
  onAddTag,
  onRemoveTag,
  participants,
  defaultDetailsOpen = false,
}: RecorderMetadataFormProps) {
  const { t } = useTranslation();

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (keyIs(e, KEY.ENTER) && e.currentTarget.value.trim()) {
      onAddTag(e.currentTarget.value.trim());
      e.currentTarget.value = "";
    }
  };

  const summary = [
    description.trim() ? description.trim() : null,
    tags.length > 0 ? tags.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PanelSection
      title={t("flowRecorder.details")}
      summary={summary || undefined}
      defaultOpen={defaultDetailsOpen}
    >
      <div>
        <label className={PANEL_LABEL_CLASS}>
          {t("flowRecorder.description")}
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={t("flowRecorder.descPlaceholder")}
            rows={2}
            className="mt-1 w-full resize-y rounded-md border border-border bg-secondary px-2.5 py-1.5 text-sm font-normal text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>

      <div>
        <span className={PANEL_LABEL_CLASS}>{t("flowRecorder.tags")}</span>
        {tags.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2 pr-1 text-xs text-secondary-foreground"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemoveTag(i)}
                  aria-label={t("flowRecorder.removeTag", { tag })}
                  className="rounded-full p-0.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          placeholder={t("flowRecorder.tagPlaceholder")}
          aria-label={t("flowRecorder.tags")}
          className={PANEL_INPUT_CLASS}
          onKeyDown={handleTagKey}
        />
      </div>

      {participants.length > 0 && (
        <div>
          <span className={PANEL_LABEL_CLASS}>{t("flowRecorder.participants")}</span>
          <p className="text-sm text-foreground">{participants.join(", ")}</p>
        </div>
      )}
    </PanelSection>
  );
}
