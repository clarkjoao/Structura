"use client";

import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingSuggestion } from "@/features/llm";
import {
  formatActionLabel,
  patchChangeKind,
  type PatchChangeKind,
} from "@/features/llm/patch-action-labels";

interface SuggestionCardProps {
  suggestion: PendingSuggestion;
  onAccept: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
}

const MARKERS: Record<PatchChangeKind, { symbol: string; className: string }> = {
  add: { symbol: "+", className: "text-success" },
  update: { symbol: "~", className: "text-warning" },
  remove: { symbol: "−", className: "text-destructive" },
  other: { symbol: "•", className: "text-muted-foreground" },
};

export function SuggestionCard({ suggestion, onAccept, onReject }: SuggestionCardProps) {
  const { t } = useTranslation();
  const isPending = suggestion.status === "pending";
  const { actions, description } = suggestion.patch;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card text-xs shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="font-semibold text-foreground">
          {t("llmChat.suggestion.defaultTitle")}
        </span>
        <span
          className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
          aria-label={t("llmChat.suggestion.changeCount", { count: actions.length })}
        >
          {actions.length}
        </span>
      </div>

      {description ? (
        <p className="px-3 pt-2 text-[11px] text-muted-foreground">{description}</p>
      ) : null}

      {/* One row per change */}
      {actions.length > 0 ? (
        <ul className="space-y-0.5 px-3 py-2">
          {actions.map((action, index) => {
            const marker = MARKERS[patchChangeKind(action)];
            return (
              <li key={index} className="flex min-w-0 items-baseline gap-2">
                <span
                  aria-hidden
                  className={cn("w-3 shrink-0 font-mono font-bold", marker.className)}
                >
                  {marker.symbol}
                </span>
                <span className="min-w-0 truncate text-foreground">
                  {formatActionLabel(action, t)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-3 py-2 text-muted-foreground">{t("llmChat.suggestion.noChanges")}</p>
      )}

      {/* Footer */}
      {isPending ? (
        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onReject(suggestion.id)}
            className="h-7 gap-1.5 text-xs"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
            {t("llmChat.suggestion.reject")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onAccept(suggestion.id)}
            className="h-7 gap-1.5 text-xs"
          >
            <Check aria-hidden className="h-3.5 w-3.5" />
            {t("llmChat.suggestion.accept")}
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center justify-center gap-2 border-t border-border px-3 py-2 font-medium",
            suggestion.status === "accepted" ? "text-success" : "text-destructive",
          )}
        >
          {suggestion.status === "accepted" ? (
            <>
              <Check aria-hidden className="h-3.5 w-3.5" />
              {t("llmChat.suggestion.accepted")}
            </>
          ) : (
            <>
              <X aria-hidden className="h-3.5 w-3.5" />
              {t("llmChat.suggestion.rejected")}
            </>
          )}
        </div>
      )}
    </div>
  );
}
