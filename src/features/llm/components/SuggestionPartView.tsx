"use client";

import type { DataMessagePartProps } from "@assistant-ui/react";
import { useLLMStore } from "@/features/llm";
import { isSuggestionPart } from "@/features/llm/message-parts";
import { SuggestionCard } from "./SuggestionCard";

/**
 * Renders a suggestion part: the pending suggestion it points at, with the
 * existing Accept/Reject actions. Once accepted, rejected, or gone (a reloaded
 * thread no longer holds session suggestions), nothing is shown.
 */
export function SuggestionPartView({ data }: DataMessagePartProps) {
  const suggestionId = isSuggestionPart(data) ? data.suggestionId : null;
  const suggestion = useLLMStore((state) =>
    suggestionId
      ? state.pendingSuggestions.find((candidate) => candidate.id === suggestionId)
      : undefined,
  );
  const accept = useLLMStore((state) => state.acceptSuggestion);
  const reject = useLLMStore((state) => state.rejectSuggestion);

  if (!suggestion || suggestion.status !== "pending") {
    return null;
  }
  return (
    <div className="mt-2">
      <SuggestionCard suggestion={suggestion} onAccept={accept} onReject={reject} />
    </div>
  );
}
