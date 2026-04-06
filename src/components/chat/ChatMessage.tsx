import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/features/llm";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUserMessage = message.role === "user";
  return (
    <div className={cn("flex w-full", isUserMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
          isUserMessage
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

