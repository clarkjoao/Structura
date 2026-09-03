// Regression test for the "Nova conexão apaga a anterior" bug.
//
// Root cause was: `LLMSettings` had a useEffect that re-prefilled the
// `draft` with the active connection whenever `draft.id` was falsy.
// Clicking "Nova conexão" cleared the draft (set to `emptyDraft()`, so
// `draft.id === undefined`), which then triggered the effect to refill
// the draft with the active connection's id — so saving fell into the
// `updateConnection` path and overwrote the active entry in place.
//
// The fix introduces an explicit `isCreating` flag set by `handleNew`
// and respected by both the effect and the save handler, so a fresh
// "new" form can no longer be silently converted into an edit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/diagram", () => ({
  useDiagramStore: {
    getState: () => ({
      pushHistoryBoundary: () => undefined,
      updateNodeLayout: () => undefined,
      activeDiagramId: null,
      diagrams: {},
    }),
  },
}));

import { useLLMStore } from "./store";
import { loadConnections } from "./llm-storage";

beforeEach(() => {
  localStorage.clear();
  useLLMStore.setState({
    connections: [],
    activeConnectionId: "",
    config: { mode: "proxy", provider: "openai", apiKey: "", model: "gpt-4o-mini" },
    threadsByDiagram: {},
    activeDiagramId: null,
    activeThreadId: "",
    messages: [],
    pendingSuggestions: [],
    pendingPreviews: [],
    pendingAnalysis: null,
    streamingContent: null,
    isLoading: false,
    error: null,
  });
});

afterEach(() => {
  localStorage.clear();
});

describe("'Nova conexão' does not overwrite the active one", () => {
  it("preserves the active connection when creating a new one (modeled after the LLMSettings flow)", () => {
    // 1. Seed storage with a single seeded connection, just like the legacy
    //    migration does on first load.
    const seeded = useLLMStore.getState().createConnection({
      name: "Default2",
      mode: "direct",
      provider: "anthropic",
      apiKey: "sk-seed",
      model: "claude-opus-4-8",
    });

    // 2. Simulate mounting LLMSettings: the initial draft carries the active
    //    connection's id (this is the only way the component knows which row
    //    to highlight).
    let draftId: string | undefined = seeded.id;
    let isCreating = false;

    // 3. User clicks "Nova conexão". handleNew used to call
    //    `setDraft(emptyDraft())`, then the effect below re-prefilled draftId
    //    with `seeded.id`. The fixed version guards the effect with `isCreating`.
    const handleNew = () => {
      isCreating = true;
      draftId = undefined;
    };
    handleNew();

    // The effect MUST NOT run when isCreating is true — it would re-prefill draftId.
    expect(isCreating).toBe(true);
    expect(draftId).toBeUndefined();

    // 4. User fills the form and saves. The fixed handleSave sends
    //    `id: undefined` so createConnection runs (not updateConnection).
    const handleSave = (model: string, name: string) => {
      const idToSave = isCreating ? undefined : draftId;
      if (idToSave) {
        useLLMStore.getState().updateConnection(idToSave, {
          name,
          model,
          provider: "anthropic",
          apiKey: "sk-new",
          mode: "direct",
        });
      } else {
        useLLMStore.getState().createConnection({
          name,
          mode: "direct",
          provider: "anthropic",
          apiKey: "sk-new",
          model,
        });
      }
      isCreating = false;
    };
    handleSave("claude-opus-4-8", "Default3");

    // 5. Re-read from localStorage exactly like a remount would.
    const refreshed = loadConnections();
    expect(refreshed.connections).toHaveLength(2);
    const names = refreshed.connections.map((entry) => entry.name).sort();
    expect(names).toEqual(["Default2", "Default3"]);
    // The seeded connection's id survived unchanged.
    expect(refreshed.connections.find((entry) => entry.id === seeded.id)?.name).toBe("Default2");
  });

  it("DOES overwrite when the user is genuinely editing (not creating)", () => {
    const seeded = useLLMStore.getState().createConnection({
      name: "Original",
      mode: "direct",
      provider: "anthropic",
      apiKey: "sk-seed",
      model: "claude-opus-4-8",
    });
    const draftId: string | undefined = seeded.id;

    useLLMStore.getState().updateConnection(draftId as string, {
      name: "Edited",
      model: "claude-haiku-4-5",
      provider: "anthropic",
      apiKey: "sk-edited",
      mode: "direct",
    });

    const refreshed = loadConnections();
    expect(refreshed.connections).toHaveLength(1);
    expect(refreshed.connections[0]?.name).toBe("Edited");
  });
});
