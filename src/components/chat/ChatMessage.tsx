import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/features/llm";
import { MarkdownContent } from "./MarkdownContent";

const COLLAPSE_THRESHOLD = 500;

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isUserMessage = message.role === "user";
  const locale = i18n.language === "pt-BR" ? ptBR : enUS;
  const timeAgo = formatDistanceToNow(message.timestamp, { addSuffix: true, locale });
  const isLong =
    !isStreaming &&
    message.role === "assistant" &&
    message.content.length > COLLAPSE_THRESHOLD;

  return (
    <div className={cn("flex w-full", isUserMessage ? "justify-end" : "justify-start")}>
      <div className="group relative max-w-[85%] pb-5">
        <div
          className={cn(
            "rounded-lg px-3 py-2.5",
            isUserMessage
              ? "bg-primary text-sm text-primary-foreground whitespace-pre-wrap"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {isUserMessage ? (
            <span>{message.content}</span>
          ) : (
            <>
              <div
                className={cn(
                  "relative",
                  !isExpanded && isLong && "max-h-52 overflow-hidden",
                )}
              >
                <MarkdownContent content={message.content} isStreaming={isStreaming} />
                {!isExpanded && isLong ? (
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-secondary to-transparent" />
                ) : null}
              </div>
              {isLong ? (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 text-[11px] text-primary hover:underline"
                >
                  {isExpanded ? t("llmChat.showLess") : t("llmChat.showMore")}
                </button>
              ) : null}
            </>
          )}
        </div>
        <span className="absolute -bottom-1 left-0 select-none whitespace-nowrap text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {timeAgo}
        </span>
      </div>
    </div>
  );
}
