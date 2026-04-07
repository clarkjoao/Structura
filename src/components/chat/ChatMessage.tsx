import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/features/llm";
import { MarkdownContent } from "./MarkdownContent";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUserMessage = message.role === "user";
  return (
    <div className={cn("flex w-full", isUserMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2.5",
          isUserMessage
            ? "bg-primary text-primary-foreground text-sm whitespace-pre-wrap"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUserMessage ? (
          <span>{message.content}</span>
        ) : (
          <MarkdownContent content={message.content} isStreaming={isStreaming} />
        )}
      </div>
    </div>
  );
}

