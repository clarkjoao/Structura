import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { QueuedMessage } from "@/features/llm/types";
import { cn } from "@/lib/utils";

/**
 * Chips for messages the user enqueued while the assistant was busy. Renders
 * nothing when the queue is empty. Each chip is a one-line preview of the
 * queued text with an X to remove it.
 */
export function QueuedMessagesBar({
  messages,
  onRemove,
}: {
  messages: readonly QueuedMessage[];
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (messages.length === 0) return null;
  return (
    <div
      aria-label={t("llmChat.queue.label", { count: messages.length })}
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t("llmChat.queue.label", { count: messages.length })}
      </span>
      {messages.map((message) => (
        <QueuedChip key={message.id} message={message} onRemove={onRemove} />
      ))}
    </div>
  );
}

const PREVIEW_MAX = 30;

function QueuedChip({
  message,
  onRemove,
}: {
  message: QueuedMessage;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const preview = truncate(message.text || t("llmChat.queue.attachmentOnly"), PREVIEW_MAX);
  const fullLabel = message.text || t("llmChat.queue.attachmentOnly");
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-muted pl-2 pr-1 text-xs text-muted-foreground",
      )}
      title={fullLabel}
      aria-label={fullLabel}
    >
      <span className="truncate">{preview}</span>
      <button
        type="button"
        onClick={() => onRemove(message.id)}
        aria-label={t("llmChat.queue.removeOne")}
        title={t("llmChat.queue.removeOne")}
        className="flex rounded p-0.5 hover:bg-background/60"
      >
        <X aria-hidden className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Cuts `text` to `max` chars, appending an ellipsis when shortened. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}
