"use client";

import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  CircleDot,
  GitBranch,
  LayoutGrid,
  Plus,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DiagramPatchAction, PendingSuggestion } from "@/features/llm";

interface SuggestionCardProps {
  suggestion: PendingSuggestion;
  onAccept: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
}

interface ActionSummary {
  type:
    | "add_node"
    | "remove_node"
    | "update_node"
    | "add_edge"
    | "remove_edge"
    | "layout"
    | "pattern"
    | "tags"
    | "unknown";
  icon: React.ReactNode;
  label: string;
  count: number;
  details: string[];
  color: string;
}

function getActionIcon(type: string) {
  switch (type) {
    case "ADD_NODE":
      return <Plus className="h-3.5 w-3.5" />;
    case "REMOVE_NODE":
      return <Trash2 className="h-3.5 w-3.5" />;
    case "UPDATE_NODE":
      return <CircleDot className="h-3.5 w-3.5" />;
    case "ADD_EDGE":
      return <GitBranch className="h-3.5 w-3.5" />;
    case "REMOVE_EDGE":
      return <GitBranch className="h-3.5 w-3.5" />;
    case "INSERT_PATTERN":
      return <LayoutGrid className="h-3.5 w-3.5" />;
    case "AUTO_LAYOUT":
      return <Zap className="h-3.5 w-3.5" />;
    case "GET_TAGS":
      return <Tag className="h-3.5 w-3.5" />;
    default:
      return <CircleDot className="h-3.5 w-3.5" />;
  }
}

function getActionColor(type: string): string {
  switch (type) {
    case "ADD_NODE":
      return "text-green-600 dark:text-green-400 bg-green-500/10";
    case "REMOVE_NODE":
      return "text-red-600 dark:text-red-400 bg-red-500/10";
    case "UPDATE_NODE":
      return "text-blue-600 dark:text-blue-400 bg-blue-500/10";
    case "ADD_EDGE":
      return "text-purple-600 dark:text-purple-400 bg-purple-500/10";
    case "REMOVE_EDGE":
      return "text-orange-600 dark:text-orange-400 bg-orange-500/10";
    case "AUTO_LAYOUT":
      return "text-amber-600 dark:text-amber-400 bg-amber-500/10";
    case "INSERT_PATTERN":
      return "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10";
    case "GET_TAGS":
      return "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10";
    default:
      return "text-muted-foreground bg-muted";
  }
}

function formatActionLabel(action: DiagramPatchAction, translate: TFunction): string {
  switch (action.type) {
    case "ADD_NODE":
      return `${action.payload.name} (${action.payload.nodeType})`;
    case "REMOVE_NODE":
      return `${translate("llmChat.suggestion.action.removeNode", { nodeId: action.payload.nodeId })}`;
    case "UPDATE_NODE":
      return `${translate("llmChat.suggestion.action.updateNode", { nodeId: action.payload.nodeId })}`;
    case "ADD_EDGE":
      return `${action.payload.label || "connection"}`;
    case "REMOVE_EDGE":
      return `${translate("llmChat.suggestion.action.removeEdge", { edgeId: action.payload.edgeId })}`;
    case "INSERT_PATTERN":
      return `${translate("llmChat.suggestion.action.insertPattern", { patternId: action.payload.patternId })}`;
    case "AUTO_LAYOUT":
      return `${translate("llmChat.suggestion.action.autoLayout")}`;
    case "GET_TAGS":
      return `${translate("llmChat.suggestion.action.getTags")}`;
    default:
      return "Unknown action";
  }
}

function groupActions(actions: DiagramPatchAction[], translate: TFunction): ActionSummary[] {
  const groups: Record<string, ActionSummary> = {};

  for (const action of actions) {
    const type = action.type;
    const key = type;

    if (!groups[key]) {
      groups[key] = {
        type: type as ActionSummary["type"],
        icon: getActionIcon(type),
        label: type.replace(/_/g, " ").toLowerCase(),
        count: 0,
        details: [],
        color: getActionColor(type),
      };
    }

    groups[key].count++;
    groups[key].details.push(formatActionLabel(action, translate));
  }

  return Object.values(groups);
}

function countChanges(actions: DiagramPatchAction[]): {
  nodes: number;
  edges: number;
  other: number;
} {
  return actions.reduce(
    (acc, action) => {
      if (action.type.includes("NODE")) acc.nodes++;
      else if (action.type.includes("EDGE")) acc.edges++;
      else acc.other++;
      return acc;
    },
    { nodes: 0, edges: 0, other: 0 },
  );
}

/* ── Animated entrance ─────────────────────────────────────────────────── */
function useEntranceAnimation(delay = 0) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return visible;
}

/* ── Main card ─────────────────────────────────────────────────────────── */
export function SuggestionCard({ suggestion, onAccept, onReject }: SuggestionCardProps) {
  const { t } = useTranslation();
  const isPending = suggestion.status === "pending";
  const visible = useEntranceAnimation(100);

  const actionGroups = useMemo(
    () => groupActions(suggestion.patch.actions, t),
    [suggestion.patch.actions, t],
  );

  const changes = useMemo(() => countChanges(suggestion.patch.actions), [suggestion.patch.actions]);

  // Build summary text
  const summaryParts: string[] = [];
  if (changes.nodes > 0) summaryParts.push(`${changes.nodes} nó${changes.nodes > 1 ? "s" : ""}`);
  if (changes.edges > 0)
    summaryParts.push(`${changes.edges} conexõe${changes.edges > 1 ? "s" : "ão"}`);
  if (changes.other > 0) summaryParts.push(`${changes.other} outra${changes.other > 1 ? "s" : ""}`);
  const summaryText = summaryParts.join(", ") || t("llmChat.suggestion.noChanges");

  // Get first few node names for preview
  const nodePreview = suggestion.patch.actions
    .filter((a) => a.type === "ADD_NODE")
    .slice(0, 3)
    .map((a) => (a.type === "ADD_NODE" ? a.payload.name : null))
    .filter(Boolean) as string[];
  const moreNodes = suggestion.patch.actions.filter((a) => a.type === "ADD_NODE").length - 3;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-md transition-all duration-300",
        "animate-in slide-in-from-bottom-4 fade-in",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        isPending && "ring-2 ring-primary/20",
      )}
      style={{ animationDuration: "300ms" }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Icon badge */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
          <ArrowRight className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Title */}
          <h4 className="mb-1 text-sm font-semibold text-foreground leading-tight">
            {suggestion.patch.description ||
              t("llmChat.suggestion.defaultTitle", { defaultValue: "Suggested changes" })}
          </h4>

          {/* Summary badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {summaryText}
            </span>

            {/* Node preview badges */}
            {nodePreview.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400"
              >
                <Plus className="h-2.5 w-2.5" />
                {name}
              </span>
            ))}

            {moreNodes > 0 && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                +{moreNodes} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action groups */}
      <div className="px-4 pb-3">
        <div className="space-y-2">
          {actionGroups.map((group) => (
            <div
              key={group.type}
              className={cn(
                "flex items-start gap-2.5 rounded-lg p-2",
                group.color.replace("text-", "hover:bg-").replace("dark:", ""),
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                  group.color,
                )}
              >
                {group.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium capitalize text-foreground">
                    {group.label.replace(/_/g, " ")}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    ×{group.count}
                  </span>
                </div>
                {/* Show first 2 details */}
                <div className="mt-0.5 space-y-0.5">
                  {group.details.slice(0, 2).map((detail, i) => (
                    <p key={i} className="truncate text-[11px] text-muted-foreground">
                      {detail}
                    </p>
                  ))}
                  {group.details.length > 2 && (
                    <p className="text-[11px] text-muted-foreground/70">
                      +{group.details.length - 2} more
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            size="sm"
            onClick={() => onAccept(suggestion.id)}
            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="h-3.5 w-3.5" />
            {t("llmChat.suggestion.accept")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onReject(suggestion.id)}
            className="flex-1 gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            {t("llmChat.suggestion.reject")}
          </Button>
        </div>
      )}

      {/* Status indicator for accepted/rejected */}
      {!isPending && (
        <div
          className={cn(
            "flex items-center justify-center gap-2 border-t px-4 py-2 text-xs font-medium",
            suggestion.status === "accepted"
              ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
              : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
          )}
        >
          {suggestion.status === "accepted" ? (
            <>
              <Check className="h-3.5 w-3.5" />
              {t("llmChat.suggestion.accepted")}
            </>
          ) : (
            <>
              <X className="h-3.5 w-3.5" />
              {t("llmChat.suggestion.rejected")}
            </>
          )}
        </div>
      )}
    </div>
  );
}
