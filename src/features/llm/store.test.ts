import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub the diagram store; the LLM store calls pushHistoryBoundary on accept/reject
// and updateNodeLayout on certain sendMessage paths, neither of which matters
// for the connection/thread CRUD tests below.
vi.mock("@/features/diagram", () => {
  const diagram = {
    id: "diagram-store",
    name: "Store test",
    level: "container",
    viewport: { x: 0, y: 0, zoom: 1 },
    snapshot: {
      components: {
        "n-1": { id: "n-1", type: "container", name: "Cache", description: "", parentId: null },
      },
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
  };
  return {
    useDiagramStore: {
      getState: () => ({
        pushHistoryBoundary: () => undefined,
        updateNodeLayout: () => undefined,
        activeDiagramId: "diagram-store",
        diagrams: { "diagram-store": diagram },
      }),
    },
    getCachedCanvasSnapshot: (d: typeof diagram) => ({
      components: d.snapshot.components,
      connections: d.snapshot.connections,
      nodeLayouts: d.nodeLayouts,
    }),
    isSharedRefComponent: () => false,
  };
});

import { countConversationMessages, useLLMStore } from "./store";
import { isErrorPart } from "./message-parts";
import {
  controllableReply,
  replyWith,
  sequenceFetch,
  toolCallReply,
} from "./test-utils/openai-sse";
import { resetLLMStorageForTests } from "./llm-storage";
import { fixtureDiagram, fixtureHost } from "./test-utils/fixture-host";
import { conversationToMarkdown } from "./message-markdown";
import i18n from "@/infrastructure/i18n";

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
    streamingContent: null,
    isLoading: false,
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

describe("LLM store — first send persists the conversation", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubProxyReply(reply: string): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => replyWith(reply)),
    );
  }

  it("creates a thread on the first send from the empty state", async () => {
    stubProxyReply("Hello");
    expect(useLLMStore.getState().activeThreadId).toBe("");

    await useLLMStore.getState().sendMessage("Explain this architecture", "ctx");

    const state = useLLMStore.getState();
    expect(state.activeThreadId).not.toBe("");
    const thread = state.threadsByDiagram["diagram-store"]?.threads.find(
      (candidate) => candidate.id === state.activeThreadId,
    );
    expect(thread?.title).toBe("Explain this architecture");
    expect(thread?.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
  });

  it("persists the user message before the response arrives", async () => {
    let release: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );

    const pending = useLLMStore.getState().sendMessage("Add a cache", "ctx");
    const inFlight = useLLMStore.getState();
    const thread = inFlight.threadsByDiagram["diagram-store"]?.threads.find(
      (candidate) => candidate.id === inFlight.activeThreadId,
    );
    expect(thread?.messages).toHaveLength(1);
    expect(thread?.messages[0]?.parts).toEqual([{ type: "text", text: "Add a cache" }]);

    await vi.waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    release(replyWith("Done"));
    await pending;
  });

  it("counts one message while the request runs and two after the response", async () => {
    let release: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );

    const pending = useLLMStore.getState().sendMessage("Add a queue", "ctx");
    const inFlight = useLLMStore.getState();
    expect(inFlight.isLoading).toBe(true);
    expect(countConversationMessages(inFlight.messages, inFlight.isLoading)).toBe(1);

    await vi.waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    release(replyWith("Done"));
    await pending;
    const done = useLLMStore.getState();
    expect(countConversationMessages(done.messages, done.isLoading)).toBe(2);
  });

  it("keeps the previous conversation in history when a new one starts (/clear)", async () => {
    stubProxyReply("Hello");
    await useLLMStore.getState().sendMessage("First question", "ctx");
    const firstId = useLLMStore.getState().activeThreadId;

    useLLMStore.getState().createThread("diagram-store");

    const threads = useLLMStore.getState().threadsByDiagram["diagram-store"]?.threads ?? [];
    expect(threads).toHaveLength(2);
    expect(threads.find((thread) => thread.id === firstId)?.messages).toHaveLength(2);
  });
});

function lastMessage<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

describe("LLM store — message parts", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
    useLLMStore.getState().setToolHost(
      fixtureHost(
        fixtureDiagram({
          "n-1": { id: "n-1", type: "container", name: "Cache", description: "", parentId: null },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sseResponse = controllableReply;

  it("streams the reply into the assistant message's text part", async () => {
    const stream = sseResponse(["Hello", " world"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => stream.response),
    );

    const pending = useLLMStore.getState().sendMessage("Hi", "ctx");
    await vi.waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    stream.push();
    await vi.waitFor(() => {
      const last = lastMessage(useLLMStore.getState().messages);
      expect(last?.parts).toEqual([{ type: "text", text: "Hello" }]);
      expect(last?.status).toBe("streaming");
    });
    stream.push();
    stream.push();
    await pending;

    const last = lastMessage(useLLMStore.getState().messages);
    expect(last?.parts).toEqual([{ type: "text", text: "Hello world" }]);
    expect(last?.status).toBe("complete");
  });

  it("cancel mid-stream keeps the partial text and marks the message cancelled", async () => {
    const stream = sseResponse(["Partial", " never sent"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        init.signal?.addEventListener("abort", () => stream.fail());
        return stream.response;
      }),
    );

    const pending = useLLMStore.getState().sendMessage("Explain", "ctx");
    await vi.waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    stream.push();
    await vi.waitFor(() => {
      expect(lastMessage(useLLMStore.getState().messages)?.parts).toEqual([
        { type: "text", text: "Partial" },
      ]);
    });
    useLLMStore.getState().cancelRequest();
    await pending;

    const state = useLLMStore.getState();
    const last = lastMessage(state.messages);
    expect(last?.status).toBe("cancelled");
    expect(last?.parts).toEqual([{ type: "text", text: "Partial" }]);
    expect(state.isLoading).toBe(false);
    expect(last?.parts.some(isErrorPart)).toBe(false);
    const thread = state.threadsByDiagram["diagram-store"]?.threads.find(
      (candidate) => candidate.id === state.activeThreadId,
    );
    expect(lastMessage(thread?.messages ?? [])?.status).toBe("cancelled");
  });

  it("stores a failed request as an error part on that turn and persists it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );

    await useLLMStore.getState().sendMessage("Review this", "ctx");

    const state = useLLMStore.getState();
    const last = lastMessage(state.messages);
    expect(last?.role).toBe("assistant");
    expect(last?.status).toBe("error");
    const errorPart = last?.parts.find(isErrorPart);
    expect(errorPart?.error).toMatchObject({ kind: "server", status: 503, mode: "proxy" });
    const thread = state.threadsByDiagram["diagram-store"]?.threads.find(
      (candidate) => candidate.id === state.activeThreadId,
    );
    expect(lastMessage(thread?.messages ?? [])?.parts.some(isErrorPart)).toBe(true);
  });

  it("Retry re-sends the same user message and replaces the failed reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );
    await useLLMStore.getState().sendMessage("Review this", "ctx");
    const failed = lastMessage(useLLMStore.getState().messages);
    expect(failed?.status).toBe("error");

    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => replyWith("All good"));
    vi.stubGlobal("fetch", fetchSpy);
    await useLLMStore.getState().rerunAssistantMessage(failed?.id ?? "", "ctx");

    const messages = useLLMStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[0]?.parts).toEqual([{ type: "text", text: "Review this" }]);
    expect(messages[1]?.id).not.toBe(failed?.id);
    expect(messages[1]?.parts).toEqual([{ type: "text", text: "All good" }]);
    expect(messages[1]?.status).toBe("complete");
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(body.messages.filter((m: { role: string }) => m.role !== "system")).toEqual([
      { role: "user", content: "Review this" },
    ]);
  });

  it("keeps a reply cut at the token limit and marks it truncated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => replyWith("Half of the", "length")),
    );
    await useLLMStore.getState().sendMessage("Explain everything", "ctx");
    const last = lastMessage(useLLMStore.getState().messages);
    expect(last?.parts).toEqual([{ type: "text", text: "Half of the" }]);
    expect(last?.truncated).toBe(true);
    expect(last?.status).toBe("complete");
  });

  it("turns the write tools of one reply into one suggestion referenced by the message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        sequenceFetch([
          () => toolCallReply([{ name: "remove_node", args: { nodeId: "n-1" } }]),
          () => replyWith("I queued the removal of the cache."),
        ]),
      ),
    );

    await useLLMStore.getState().sendMessage("Remove the cache", "ctx");

    const state = useLLMStore.getState();
    expect(state.pendingSuggestions).toHaveLength(1);
    const suggestion = state.pendingSuggestions[0];
    expect(suggestion?.status).toBe("pending");
    expect(suggestion?.patch.actions).toEqual([
      { type: "REMOVE_NODE", payload: { nodeId: "n-1" } },
    ]);
    const last = lastMessage(state.messages);
    expect(last?.parts[last.parts.length - 1]).toEqual({
      type: "suggestion",
      suggestionId: suggestion?.id,
    });
    expect(last?.status).toBe("complete");
  });
});

describe("LLM store — Accept and Reject", () => {
  let host: ReturnType<typeof fixtureHost>;

  beforeEach(() => {
    localStorage.clear();
    resetStore();
    host = fixtureHost(
      fixtureDiagram({
        "n-1": { id: "n-1", type: "container", name: "Cache", description: "", parentId: null },
      }),
    );
    useLLMStore.getState().setToolHost(host);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        sequenceFetch([
          () =>
            toolCallReply([
              { name: "update_node", args: { nodeId: "n-1", patch: { name: "Redis" } } },
              { name: "add_node", args: { nodeType: "container", name: "API", parentId: null } },
            ]),
          () => replyWith("Done."),
        ]),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useLLMStore.getState().setToolHost(null);
  });

  it("nothing is applied before Accept; Accept applies the whole suggestion in one batch", async () => {
    await useLLMStore.getState().sendMessage("Rename and add", "ctx");
    expect(host.applied).toEqual([]);

    const suggestion = useLLMStore.getState().pendingSuggestions[0];
    await useLLMStore.getState().acceptSuggestion(suggestion?.id ?? "");

    expect(host.applied).toHaveLength(1);
    expect(host.applied[0]?.map((change) => change.kind)).toEqual(["updateNode", "addNode"]);
    expect(useLLMStore.getState().pendingSuggestions[0]?.status).toBe("accepted");
  });

  it("Reject changes nothing", async () => {
    await useLLMStore.getState().sendMessage("Rename and add", "ctx");
    const suggestion = useLLMStore.getState().pendingSuggestions[0];
    useLLMStore.getState().rejectSuggestion(suggestion?.id ?? "");
    expect(host.applied).toEqual([]);
    expect(useLLMStore.getState().pendingSuggestions[0]?.status).toBe("rejected");
  });
});

describe("LLM store — review requests are normal turns", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a review command suggestion sends its label as a normal turn with no analysis state", async () => {
    const prompt = i18n.t("llmChat.command.review.label");
    const markdown = "**Summary**\n\n### High\n- **Orders DB** has no replica.";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => replyWith(markdown)),
    );

    await useLLMStore.getState().sendMessage(prompt, "ctx", {
      command: { id: "review", name: "review" },
    });

    const state = useLLMStore.getState();
    expect(state.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(state.messages[0]?.parts).toEqual([{ type: "text", text: prompt }]);
    expect(state.messages[0]?.command).toEqual({ id: "review", name: "review" });
    expect(lastMessage(state.messages)?.parts).toEqual([{ type: "text", text: markdown }]);
    expect(state.pendingSuggestions).toEqual([]);
    expect("pendingAnalysis" in state).toBe(false);
  });
});

describe("LLM store — mentions travel with the user message", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
    useLLMStore.getState().setToolHost(
      fixtureHost(
        fixtureDiagram({
          "n-1": {
            id: "n-1",
            type: "container",
            name: 'Cache "hot"',
            description: "",
            parentId: null,
          },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useLLMStore.getState().setToolHost(null);
  });

  function userContentOf(init: RequestInit | undefined): string {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      messages: Array<{ role: string; content: string }>;
    };
    const users = body.messages.filter((m) => m.role === "user");
    return users[users.length - 1]?.content ?? "";
  }

  it("stores the refs and sends them resolved as an encoded block; Retry resends them", async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init: RequestInit) => new Response("down", { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await useLLMStore.getState().sendMessage("What does this do?", "ctx", {
      mentions: [{ kind: "node", id: "n-1", label: "Cache" }],
    });

    const user = useLLMStore.getState().messages[0];
    expect(user?.mentions).toEqual([{ kind: "node", id: "n-1", label: "Cache" }]);
    const first = userContentOf(fetchSpy.mock.calls[0]?.[1]);
    expect(first.startsWith("What does this do?")).toBe(true);
    expect(first).toContain('"name": "Cache \\"hot\\""');

    const failed = useLLMStore.getState().messages[1];
    const retrySpy = vi.fn(async (_url: string, _init: RequestInit) => replyWith("ok"));
    vi.stubGlobal("fetch", retrySpy);
    await useLLMStore.getState().rerunAssistantMessage(failed?.id ?? "", "ctx");

    expect(userContentOf(retrySpy.mock.calls[0]?.[1])).toBe(first);
  });
});

describe("LLM store — prompt commands", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
    useLLMStore.getState().setToolHost(fixtureHost(fixtureDiagram({})));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useLLMStore.getState().setToolHost(null);
  });

  it("stores the command and the extra text; the model gets the instruction, the user sees /name", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => replyWith("Findings…"));
    vi.stubGlobal("fetch", fetchSpy);

    await useLLMStore
      .getState()
      .sendMessage("focus on the database", "ctx", { command: { id: "review", name: "review" } });

    const state = useLLMStore.getState();
    const user = state.messages[0];
    expect(user?.command).toEqual({ id: "review", name: "review" });
    expect(user?.parts).toEqual([{ type: "text", text: "focus on the database" }]);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body ?? "{}")) as {
      messages: Array<{ role: string; content: string }>;
    };
    const sent = body.messages.find((m) => m.role === "user")?.content ?? "";
    expect(sent).toMatch(/^Review the architecture/);
    expect(sent).toContain("focus on the database");
    // Visible form, not the instruction, for the title and /copy.
    const thread = state.threadsByDiagram["diagram-store"]?.threads[0];
    expect(thread?.title).toBe("/review focus on the database");
    const markdown = conversationToMarkdown(state.messages, {
      t: i18n.t.bind(i18n),
      findSuggestion: () => undefined,
    });
    expect(markdown).toContain("/review focus on the database");
    expect(markdown).not.toContain("Review the architecture in the diagram");
  });

  it("sends a command chip with no extra text", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => replyWith("ok"));
    vi.stubGlobal("fetch", fetchSpy);
    await useLLMStore
      .getState()
      .sendMessage("", "ctx", { command: { id: "explain", name: "explain" } });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(useLLMStore.getState().messages[0]?.command?.name).toBe("explain");
  });
});

describe("LLM store — message queue", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendMessage while isLoading enqueues instead of running a turn", async () => {
    useLLMStore.setState({ isLoading: true });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const accepted = await useLLMStore.getState().sendMessage("next", "ctx");

    expect(accepted).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useLLMStore.getState().queuedMessages).toHaveLength(1);
    expect(useLLMStore.getState().queuedMessages[0]?.text).toBe("next");
  });

  it("refuses the 11th queued message and returns false", async () => {
    useLLMStore.setState({ isLoading: true });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // 10 already in the queue.
    useLLMStore.setState({
      queuedMessages: Array.from({ length: 10 }, (_, i) => ({
        id: `seed-${i}`,
        text: `seed ${i}`,
        mentions: [],
        skills: [],
      })),
    });

    const accepted = await useLLMStore.getState().sendMessage("overflow", "ctx");

    expect(accepted).toBe(false);
    expect(useLLMStore.getState().queuedMessages).toHaveLength(10);
  });

  it("removeQueuedMessage filters by id", () => {
    useLLMStore.setState({
      queuedMessages: [
        { id: "a", text: "first", mentions: [], skills: [] },
        { id: "b", text: "second", mentions: [], skills: [] },
      ],
    });
    useLLMStore.getState().removeQueuedMessage("a");
    expect(useLLMStore.getState().queuedMessages.map((m) => m.id)).toEqual(["b"]);
  });

  it("drains the queue on turn success", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => replyWith("ok"));
    vi.stubGlobal("fetch", fetchSpy);
    useLLMStore.setState({
      queuedMessages: [
        { id: "q-1", text: "queued one", mentions: [], skills: [] },
        { id: "q-2", text: "queued two", mentions: [], skills: [] },
      ],
    });

    await useLLMStore.getState().sendMessage("first", "ctx");

    // After the first turn completes, the drain runs `sendMessage` for `q-1`,
    // which then drains `q-2`. So fetch ends up being called 3 times (first
    // + 2 drains).
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(useLLMStore.getState().queuedMessages).toEqual([]);

    const userTexts = fetchSpy.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body ?? "{}")) as {
        messages: Array<{ role: string; content: string }>;
      };
      return body.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" ");
    });
    expect(userTexts.some((t) => t.includes("first"))).toBe(true);
    expect(userTexts.some((t) => t.includes("queued one"))).toBe(true);
    expect(userTexts.some((t) => t.includes("queued two"))).toBe(true);
  });

  it("builds the diagram context for a drained message when it is sent", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => replyWith("ok"));
    vi.stubGlobal("fetch", fetchSpy);
    let current = "diagram before accept";
    useLLMStore.getState().setDiagramContextSource(() => current);
    useLLMStore.setState({
      queuedMessages: [{ id: "q-1", text: "queued one", mentions: [], skills: [] }],
    });

    const sending = useLLMStore.getState().sendMessage("first", "diagram before accept");
    current = "diagram after accept";
    await sending;
    useLLMStore.getState().setDiagramContextSource(null);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1]?.[1]?.body)).toContain("diagram after accept");
    expect(String(fetchSpy.mock.calls[1]?.[1]?.body)).not.toContain("diagram before accept");
  });

  it("drains the queue on turn error", async () => {
    const fetchSpy = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response("server down", { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    useLLMStore.setState({
      queuedMessages: [{ id: "q-1", text: "after error", mentions: [], skills: [] }],
    });

    await useLLMStore.getState().sendMessage("trigger error", "ctx");

    // First call triggers the error, then the drain fires the queued one.
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    const userTexts = fetchSpy.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body ?? "{}")) as {
        messages: Array<{ role: string; content: string }>;
      };
      return body.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" ");
    });
    expect(userTexts.some((t) => t.includes("after error"))).toBe(true);
  });

  it("does not drain the queue on explicit cancel", async () => {
    // A fetch that never resolves unless the signal aborts; the cancel call
    // rejects the request, which the store maps to a cancellation.
    const fetchSpy = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const sendPromise = useLLMStore.getState().sendMessage("first", "ctx");
    // Wait for the store to set isLoading and stash the AbortController.
    await new Promise((resolve) => setTimeout(resolve, 0));
    useLLMStore.getState().cancelRequest();
    await sendPromise.catch(() => undefined);

    // Queue was empty before the cancel; it stays empty after.
    expect(useLLMStore.getState().queuedMessages).toEqual([]);
    expect(useLLMStore.getState().isLoading).toBe(false);
  });
});
