"use client";

import { useState, type PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { Ban, Check, ChevronRight, CircleX, Loader2, Lock } from "lucide-react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { cn } from "@/lib/utils";
import {
  isMcpToolCall,
  isToolCallPart,
  type ToolCallPart,
  type ToolCallStatus,
} from "@/features/llm/message-parts";
import { toolCallStatusKey } from "@/features/llm/message-markdown";

function StatusIcon({ status }: { status: ToolCallStatus }) {
  switch (status) {
    case "running":
      return <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
    case "done":
      return <Check aria-hidden className="h-3.5 w-3.5 text-success" />;
    case "error":
      return <CircleX aria-hidden className="h-3.5 w-3.5 text-destructive" />;
    case "awaiting-approval":
      return <Lock aria-hidden className="h-3.5 w-3.5 text-warning" />;
    case "denied":
      return <Ban aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

/** One compact row per tool call, expandable to its arguments and result. */
export function ToolCallRow({ part }: { part: ToolCallPart }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const statusLabel = part.stopped ? t("llmChat.stopped") : t(toolCallStatusKey(part.status));

  return (
    <div className="text-xs" data-testid="tool-call-row">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-label={t(expanded ? "llmChat.toolCall.hideDetails" : "llmChat.toolCall.showDetails", {
          name: part.name,
        })}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60"
      >
        <StatusIcon status={part.status} />
        <span className="shrink-0 text-muted-foreground">{statusLabel}</span>
        <span className="min-w-0 truncate font-mono text-foreground">{part.name}</span>
        {isMcpToolCall(part) ? (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {t("llmChat.toolCall.mcpBadge", { server: part.serverId })}
          </span>
        ) : null}
        <ChevronRight
          aria-hidden
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>
      {expanded ? (
        <div className="space-y-2 border-t border-border px-2.5 py-2">
          <ToolCallDetail label={t("llmChat.toolCall.arguments")} value={part.args} />
          {part.result !== undefined ? (
            <ToolCallDetail label={t("llmChat.toolCall.result")} value={part.result} />
          ) : null}
          {part.error ? (
            <ToolCallDetail label={t("llmChat.toolCall.error")} value={part.error} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolCallDetail({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px]">
        {formatValue(value)}
      </pre>
    </div>
  );
}

/** Consecutive tool calls share one bordered box. */
export function ToolCallGroup({ children }: PropsWithChildren) {
  return (
    <div className="my-2 divide-y divide-border overflow-hidden rounded-md border border-border bg-background/50">
      {children}
    </div>
  );
}

/**
 * assistant-ui renderer for tool-call parts. The adapter carries the Structura
 * part in `artifact`; anything else is not ours to render.
 */
export function ToolCallPartView({ artifact }: Pick<ToolCallMessagePartProps, "artifact">) {
  if (!isToolCallPart(artifact)) {
    return null;
  }
  return <ToolCallRow part={artifact} />;
}
