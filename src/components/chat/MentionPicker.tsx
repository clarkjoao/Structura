import { ArrowRight, Box } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MentionItem } from "@/features/llm";
import { cn } from "@/lib/utils";

interface MentionPickerProps {
  items: MentionItem[];
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onDismiss: () => void;
}

export function MentionPicker({
  items,
  selectedIndex,
  onSelect,
  onDismiss,
}: MentionPickerProps) {
  const { t } = useTranslation();

  return (
    <div
      className="absolute bottom-full left-0 mb-2 w-full max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md z-30"
      aria-label={t("llmChat.mention.pickerLabel")}
    >
      {items.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {t("llmChat.mention.noResults")}
        </div>
      ) : (
        items.map((item, index) => (
          <button
            key={`${item.kind}-${item.id}`}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-xs",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-foreground hover:bg-accent/70",
            )}
          >
            {item.kind === "node" ? (
              <Box className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate font-medium">{item.label}</span>
            <span className="truncate text-muted-foreground">{item.subLabel}</span>
          </button>
        ))
      )}
      <button
        type="button"
        className="sr-only"
        onClick={onDismiss}
        aria-label={t("common.close")}
      />
    </div>
  );
}

