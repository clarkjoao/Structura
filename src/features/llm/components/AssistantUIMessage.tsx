"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuiState, MessagePrimitive } from "@assistant-ui/react";

const COLLAPSE_THRESHOLD = 500;

function getPartText(message: { parts: readonly unknown[] }): string {
  for (const part of message.parts) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      (part as { type: unknown }).type === "text" &&
      "text" in part &&
      typeof (part as { text: unknown }).text === "string"
    ) {
      return (part as { text: string }).text;
    }
  }
  return "";
}

export function UserMessageComponent() {
  const { i18n } = useTranslation();
  const message = useAuiState((s) => s.message);
  const locale = i18n.language === "pt-BR" ? ptBR : enUS;
  const timeAgo = formatDistanceToNow(message.createdAt, { addSuffix: true, locale });
  const text = getPartText(message);

  return (
    <div className="flex w-full min-w-0 justify-end">
      <div className="group relative max-w-[85%] min-w-0 pb-5">
        <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] shadow-sm">
          <span>{text || " "}</span>
        </div>
        <span className="absolute -bottom-1 left-0 select-none whitespace-nowrap text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {timeAgo}
        </span>
      </div>
    </div>
  );
}

export function AssistantMessageComponent() {
  const { i18n } = useTranslation();
  const message = useAuiState((s) => s.message);
  const text = getPartText(message);
  const isStreaming = message.status?.type === "running";
  const locale = i18n.language === "pt-BR" ? ptBR : enUS;
  const timeAgo = formatDistanceToNow(message.createdAt, { addSuffix: true, locale });
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = !isStreaming && text.length > COLLAPSE_THRESHOLD;

  if (isStreaming && text.length === 0) {
    return (
      <div className="flex w-full min-w-0 justify-start">
        <div className="group relative max-w-[85%] min-w-0 pb-5">
          <div className="rounded-2xl bg-secondary/60 px-4 py-3 text-secondary-foreground ring-1 ring-border/40">
            <GeneratingSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 justify-start">
      <div className="group relative max-w-[90%] min-w-0 pb-5">
        <div className="rounded-2xl bg-secondary/60 px-4 py-3 text-secondary-foreground ring-1 ring-border/40">
          <div className={cn("relative", !isExpanded && isLong && "max-h-52 overflow-hidden")}>
            {/* MessagePrimitive.Parts renders each part with the correct
                provider context, including the smooth streaming animation
                and markdown rendering for text parts. */}
            <MessagePrimitive.Parts />
            {!isExpanded && isLong ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-secondary/95 to-transparent" />
            ) : null}
          </div>
          {isLong ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1.5 text-[11px] text-primary hover:underline"
            >
              {isExpanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>
        <span className="absolute -bottom-1 left-0 select-none whitespace-nowrap text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {timeAgo}
        </span>
      </div>
    </div>
  );
}

function GeneratingSkeleton() {
  return (
    <div className="space-y-2 py-1.5" aria-label="Generating">
      {[100, 75, 55].map((width) => (
        <div
          key={width}
          className="h-2 animate-pulse rounded-full bg-muted"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}
