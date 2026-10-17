import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import type { PendingSuggestion } from "@/features/llm";
import { SuggestionCard } from "./SuggestionCard";

const suggestion: PendingSuggestion = {
  id: "s-1",
  messageId: "a-1",
  status: "pending",
  patch: {
    id: "p-1",
    description: "Put a cache in front of the database",
    actions: [
      {
        type: "ADD_NODE",
        payload: { ref: "new-1", nodeType: "container", name: "Redis", parentId: null },
      },
      { type: "UPDATE_NODE", payload: { nodeId: "api", patch: { name: "API" } } },
      { type: "REMOVE_EDGE", payload: { edgeId: "e-1" } },
    ],
  },
};

describe("SuggestionCard", () => {
  it("shows the header with the change count and one marked row per change", () => {
    render(<SuggestionCard suggestion={suggestion} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText(i18n.t("llmChat.suggestion.defaultTitle"))).toBeTruthy();
    expect(
      screen.getByLabelText(i18n.t("llmChat.suggestion.changeCount", { count: 3 })),
    ).toBeTruthy();

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual(["+", "~", "−"]);
    expect(rows[0]?.firstElementChild?.className).toContain("text-success");
    expect(rows[1]?.firstElementChild?.className).toContain("text-warning");
    expect(rows[2]?.firstElementChild?.className).toContain("text-destructive");
    expect(rows[0]?.textContent).toContain("Redis (container)");
  });

  it("keeps the Accept and Reject actions", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(<SuggestionCard suggestion={suggestion} onAccept={onAccept} onReject={onReject} />);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("llmChat.suggestion.accept") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("llmChat.suggestion.reject") }));
    expect(onAccept).toHaveBeenCalledWith("s-1");
    expect(onReject).toHaveBeenCalledWith("s-1");
  });
});

describe("SuggestionCard — undo step and skipped changes", () => {
  it("says the suggestion applies as one undo step", () => {
    render(<SuggestionCard suggestion={suggestion} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText(i18n.t("llmChat.suggestion.oneUndoStep"))).toBeTruthy();
  });

  it("marks the changes that were skipped at Accept time", () => {
    render(
      <SuggestionCard
        suggestion={{
          ...suggestion,
          status: "accepted",
          skipped: [{ actionIndex: 1, reason: "missingNode" }],
        }}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText(i18n.t("llmChat.suggestion.skipped.missingNode"))).toBeTruthy();
    expect(screen.getAllByRole("listitem")[1]?.className).toContain("line-through");
  });
});
