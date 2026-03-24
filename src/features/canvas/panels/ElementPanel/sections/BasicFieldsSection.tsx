import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import Field from "../components/Field";

export interface BasicFieldsSectionProps {
  name: string;
  desc: string;
  tech: string;
  tags: string[];
  tagInput: string;
  isNote: boolean;
  isPanel: boolean;
  isAws: boolean;
  /** When false, the name field is omitted (e.g. when rendered in a second block after type selectors). */
  showName?: boolean;
  /** When false, the description field is omitted. */
  showDescription?: boolean;
  /** When true, shows technology (non-simple components). */
  showTechnology?: boolean;
  /** When true, shows tag chips + input. */
  showTags?: boolean;
  titleInputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onChangeName: (value: string) => void;
  onChangeDesc: (value: string) => void;
  onChangeTech: (value: string) => void;
  onChangeTagInput: (value: string) => void;
  onRemoveTag: (tag: string) => void;
  onCommitTagInput: () => void;
}

export function BasicFieldsSection({
  name,
  desc,
  tech,
  tags,
  tagInput,
  isNote,
  showName = true,
  showDescription = true,
  showTechnology = false,
  showTags = false,
  titleInputRef,
  onChangeName,
  onChangeDesc,
  onChangeTech,
  onChangeTagInput,
  onRemoveTag,
  onCommitTagInput,
}: BasicFieldsSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      {showName && (
        <Field label={t("common.name")} value={name} onChange={onChangeName} inputRef={titleInputRef} />
      )}
      {showDescription && (
        <Field
          label={isNote ? t("endpointPanel.content") : t("common.description")}
          value={desc}
          onChange={onChangeDesc}
          multiline
          placeholder={isNote ? t("elementPanel.notePlaceholder") : undefined}
          hint={isNote ? t("endpointPanel.markdownHint") : undefined}
        />
      )}
      {showTechnology && (
        <Field label={t("common.technology")} value={tech} onChange={onChangeTech} />
      )}
      {showTags && (
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("common.tags")}
          </label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    className="hover:text-foreground leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={tagInput}
            onChange={(event) => onChangeTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && tagInput.trim()) {
                event.preventDefault();
                onCommitTagInput();
              }
            }}
            placeholder={t("elementPanel.tagsPlaceholder")}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
    </>
  );
}
