import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ActiveMention } from "@/features/llm";

interface MentionTagProps {
  mention: ActiveMention;
  onRemove: (mentionId: string) => void;
}

export function MentionTag({ mention, onRemove }: MentionTagProps) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 bg-primary/15 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
      @{mention.label}
      <button
        type="button"
        onClick={() => onRemove(mention.mentionId)}
        aria-label={t("llmChat.mention.removeTag", { label: mention.label })}
        className="inline-flex items-center"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

