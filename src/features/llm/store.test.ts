import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub the diagram store; the LLM store calls pushHistoryBoundary on accept/reject
// and updateNodeLayout on certain sendMessage paths, neither of which matters
// for the connection/thread CRUD tests below.
vi.mock("@/features/diagram", () => ({
  useDiagramStore: {
    getState: () => ({
      pushHistoryBoundary: () => undefined,
      updateNodeLayout: () => undefined,
      activeDiagramId: "diagram-store",
      diagrams: { "diagram-store": { viewport: { x: 0, y: 0, zoom: 1 } } },
    }),
  },
}));

import { useLLMStore } from "./store";
import { resetLLMStorageForTests } from "./llm-storage";

beforeEach(() => {
  localStorage.clear();
  resetLLMStorageForTests();
});

afterEach(() => {
  localStorage.clear();
  resetLLMStorageForTests();
});

function resetStore(): void {
  useLLMStore.setState({
    connections: [],
    activeConnectionId: "",
    config: {
      mode: "proxy",
      provider: "openai",
      apiKey: "",
      model: "gpt-4o-mini",
    },
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
}

describe("LLM store — connection lifecycle", () => {
  beforeEach(() => {
    resetStore();
  });

  it("createConnection appends a new connection, marks it active, persists", () => {
    const initial = useLLMStore.getState().connections;
    expect(initial.length).toBe(0);

    const next = useLLMStore.getState().createConnection({
      name: "Anthropic-prod",
      mode: "direct",
      provider: "anthropic",
      apiKey: "sk-ant",
      model: "claude-sonnet-4-5",
    });
    const after = useLLMStore.getState();
    expect(after.connections.find((connection) => connection.id === next.id)).toBeDefined();
    expect(after.activeConnectionId).toBe(next.id);
    expect(after.config.provider).toBe("anthropic");
  });

  it("setActiveConnection resolves to the right connection's derived config", () => {
    const a = useLLMStore.getState().createConnection({
      name: "A",
      mode: "direct",
      provider: "openai",
      apiKey: "k-a",
      model: "gpt-4o",
    });
    const b = useLLMStore.getState().createConnection({
      name: "B",
      mode: "direct",
      provider: "anthropic",
      apiKey: "k-b",
      model: "claude-sonnet-4-5",
    });
    useLLMStore.getState().setActiveConnection(a.id);
    expect(useLLMStore.getState().config.provider).toBe("openai");
    useLLMStore.getState().setActiveConnection(b.id);
    expect(useLLMStore.getState().config.provider).toBe("anthropic");
  });

  it("duplicateConnection creates a copy with '(copy)' suffix", () => {
    const source = useLLMStore.getState().createConnection({
      name: "Source",
      mode: "direct",
      provider: "openai",
      apiKey: "k",
      model: "gpt-4o",
    });
    const duplicate = useLLMStore.getState().duplicateConnection(source.id);
    expect(duplicate).not.toBeNull();
    expect(duplicate?.id).not.toBe(source.id);
    expect(duplicate?.name).toMatch(/\(copy\)|\(cópia\)/);
    expect(duplicate?.apiKey).toBe("k");
  });

  it("removeConnection refuses to remove the active connection", () => {
    const active = useLLMStore.getState().createConnection({
      name: "Active",
      mode: "direct",
      provider: "openai",
      apiKey: "",
      model: "gpt-4o-mini",
    });
    const result = useLLMStore.getState().removeConnection(active.id);
    expect(result).toBe(false);
    expect(
      useLLMStore.getState().connections.some((connection) => connection.id === active.id),
    ).toBe(true);
  });

  it("removeConnection deletes a non-active connection and succeeds", () => {
    const first = useLLMStore.getState().createConnection({
      name: "First",
      mode: "proxy",
      provider: "openai",
      apiKey: "",
      model: "gpt-4o-mini",
    });
    const second = useLLMStore.getState().createConnection({
      name: "Second",
      mode: "direct",
      provider: "anthropic",
      apiKey: "k",
      model: "claude-haiku-4-5",
    });
    const result = useLLMStore.getState().removeConnection(first.id);
    expect(result).toBe(true);
    expect(
      useLLMStore.getState().connections.some((connection) => connection.id === first.id),
    ).toBe(false);
    expect(
      useLLMStore.getState().connections.some((connection) => connection.id === second.id),
    ).toBe(true);
    // Active stays on second (since first was deleted and was not active at deletion time).
    expect(useLLMStore.getState().activeConnectionId).toBe(second.id);
  });
});

describe("LLM store — thread lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it("createThread seeds a new thread for the diagram and makes it active", () => {
    const draft = useLLMStore.getState().createThread("diagram-1");
    expect(draft.diagramId).toBe("diagram-1");
    expect(draft.title.length).toBeGreaterThan(0);
    const state = useLLMStore.getState();
    expect(state.activeThreadId).toBe(draft.id);
    expect(state.threadsByDiagram["diagram-1"].threads).toHaveLength(1);
  });

  it("createThread derives its title from the first user message", () => {
    const draft = useLLMStore
      .getState()
      .createThread("diagram-1", "Add a Postgres database and an API Gateway");
    expect(draft.title).toBe("Add a Postgres database and an API Gateway");
  });

  it("switchThread shows the targeted thread messages and keeps both alive", () => {
    const a = useLLMStore.getState().createThread("diagram-1");
    const b = useLLMStore.getState().createThread("diagram-1");
    expect(useLLMStore.getState().activeThreadId).toBe(b.id);

    useLLMStore.getState().switchThread(a.id);
    expect(useLLMStore.getState().activeThreadId).toBe(a.id);
    const diagramState = useLLMStore.getState().threadsByDiagram["diagram-1"];
    expect(diagramState.threads.find((thread) => thread.id === a.id)).toBeDefined();
    expect(diagramState.threads.find((thread) => thread.id === b.id)).toBeDefined();
  });

  it("renameThread updates the persisted title", () => {
    const thread = useLLMStore.getState().createThread("diagram-1", "Original");
    useLLMStore.getState().renameThread(thread.id, "Renamed");
    const entry = useLLMStore.getState().threadsByDiagram["diagram-1"];
    expect(entry.threads.find((candidate) => candidate.id === thread.id)?.title).toBe("Renamed");
  });

  it("deleteThread removes the thread and activates the latest remaining", () => {
    const a = useLLMStore.getState().createThread("diagram-1");
    const b = useLLMStore.getState().createThread("diagram-1");
    expect(useLLMStore.getState().activeThreadId).toBe(b.id);
    useLLMStore.getState().deleteThread(a.id);
    const entry = useLLMStore.getState().threadsByDiagram["diagram-1"];
    expect(entry.threads).toHaveLength(1);
    expect(entry.threads[0]?.id).toBe(b.id);
    expect(useLLMStore.getState().activeThreadId).toBe(b.id);
  });

  it("deleteThread on the only thread creates a new empty one", () => {
    // Belt-and-suspenders: even with the describe-level reset, isolate this
    // case so leftover threads from earlier tests in the same file don't
    // double the active-thread count.
    localStorage.clear();
    resetStore();

    const diagramId = "diagram-isolated";
    const only = useLLMStore.getState().createThread(diagramId);
    expect(useLLMStore.getState().threadsByDiagram[diagramId]?.threads ?? []).toHaveLength(1);
    useLLMStore.getState().deleteThread(only.id);
    const entry = useLLMStore.getState().threadsByDiagram[diagramId];
    expect(entry.threads).toHaveLength(1);
    expect(entry.threads[0]?.id).not.toBe(only.id);
  });
});
