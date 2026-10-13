import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/diagram", () => {
  const diagram = {
    id: "d1",
    name: "Loop test",
    level: "container",
    viewport: { x: 0, y: 0, zoom: 1 },
    snapshot: {
      components: {
        api: { id: "api", type: "container", name: "API", description: "", parentId: null },
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
      getState: () => ({ activeDiagramId: "d1", diagrams: { d1: diagram } }),
    },
    getCachedCanvasSnapshot: (d: typeof diagram) => ({
      components: d.snapshot.components,
      connections: d.snapshot.connections,
      nodeLayouts: d.nodeLayouts,
    }),
    isSharedRefComponent: () => false,
  };
});

import {
  failRunningToolCalls,
  isSuggestionPart,
  isToolCallPart,
  type ToolCallPart,
} from "./message-parts";
import { resetLLMStorageForTests } from "./llm-storage";
import { useLLMStore } from "./store";
import { MAX_TOOL_STEPS } from "./transport/ai-sdk-transport";
import {
  controllableReply,
  replyWith,
  sequenceFetch,
  toolCallReply,
} from "./test-utils/openai-sse";

function resetStore(): void {
  useLLMStore.setState({
    config: { mode: "proxy", provider: "openai", apiKey: "", model: "m" },
    threadsByDiagram: {},
    activeDiagramId: null,
    activeThreadId: "",
    messages: [],
    pendingSuggestions: [],
    streamingContent: null,
    isLoading: false,
  });
}

function lastToolCalls(): ToolCallPart[] {
  const messages = useLLMStore.getState().messages;
  return messages[messages.length - 1]?.parts.filter(isToolCallPart) ?? [];
}

beforeEach(() => {
  localStorage.clear();
  resetLLMStorageForTests();
  resetStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("multi-step tool loop", () => {
  it("read then write in one turn: tool calls in order, then text, and one suggestion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        sequenceFetch([
          () => toolCallReply([{ name: "get_diagram_summary", args: {} }]),
          () =>
            toolCallReply([
              { name: "add_node", args: { nodeType: "container", name: "Cache", parentId: null } },
              { name: "add_edge", args: { sourceId: "api", targetId: "new-1", label: "reads" } },
            ]),
          () => replyWith("I suggest a cache in front of the API."),
        ]),
      ),
    );

    await useLLMStore.getState().sendMessage("Add a cache", "ctx");

    const state = useLLMStore.getState();
    const last = state.messages[state.messages.length - 1];
    expect(last?.parts.map((part) => part.type)).toEqual([
      "tool-call",
      "tool-call",
      "tool-call",
      "text",
      "suggestion",
    ]);
    expect(lastToolCalls().map((call) => [call.name, call.status])).toEqual([
      ["get_diagram_summary", "done"],
      ["add_node", "done"],
      ["add_edge", "done"],
    ]);
    expect(lastToolCalls()[0]?.result).toMatchObject({ name: "Loop test" });
    expect(state.pendingSuggestions).toHaveLength(1);
    expect(state.pendingSuggestions[0]?.patch.actions.map((action) => action.type)).toEqual([
      "ADD_NODE",
      "ADD_EDGE",
    ]);
  });

  it("shows a tool error result as a failed call and lets the model continue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        sequenceFetch([
          () => toolCallReply([{ name: "remove_node", args: { nodeId: "ghost" } }]),
          () => replyWith("That node does not exist."),
        ]),
      ),
    );
    await useLLMStore.getState().sendMessage("Remove ghost", "ctx");
    expect(lastToolCalls()[0]?.status).toBe("error");
    expect(useLLMStore.getState().pendingSuggestions).toEqual([]);
  });

  it(`stops after MAX_TOOL_STEPS (${MAX_TOOL_STEPS}) model calls`, async () => {
    const fetchSpy = vi.fn(sequenceFetch([() => toolCallReply([{ name: "get_tags", args: {} }])]));
    vi.stubGlobal("fetch", fetchSpy);
    await useLLMStore.getState().sendMessage("Loop forever", "ctx");
    expect(fetchSpy).toHaveBeenCalledTimes(MAX_TOOL_STEPS);
    expect(lastToolCalls()).toHaveLength(MAX_TOOL_STEPS);
  });

  it("cancel mid-loop keeps completed calls and drops the turn's suggestion", async () => {
    const hanging = controllableReply(["Thinking about"]);
    const sequence = sequenceFetch([
      () =>
        toolCallReply([
          { name: "add_node", args: { nodeType: "container", name: "Cache", parentId: null } },
        ]),
      () => hanging.response,
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        init.signal?.addEventListener("abort", () => hanging.fail());
        return sequence(url, init);
      }),
    );

    const pending = useLLMStore.getState().sendMessage("Add a cache", "ctx");
    await vi.waitFor(() => {
      expect(lastToolCalls()[0]?.status).toBe("done");
    });
    hanging.push();
    await vi.waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });
    useLLMStore.getState().cancelRequest();
    await pending;

    const state = useLLMStore.getState();
    const last = state.messages[state.messages.length - 1];
    expect(last?.status).toBe("cancelled");
    expect(lastToolCalls().map((call) => call.status)).toEqual(["done"]);
    expect(state.pendingSuggestions).toEqual([]);
    expect(last?.parts.some((part) => isSuggestionPart(part))).toBe(false);
  });

  it("a call still running when the reply stops ends as stopped", () => {
    const message = failRunningToolCalls(
      {
        id: "a",
        role: "assistant",
        timestamp: 0,
        parts: [
          {
            type: "tool-call",
            id: "1",
            name: "get_tags",
            source: "internal",
            args: {},
            status: "done",
          },
          {
            type: "tool-call",
            id: "2",
            name: "add_node",
            source: "internal",
            args: {},
            status: "running",
          },
        ],
      },
      true,
    );
    expect(message.parts.filter(isToolCallPart).map((call) => [call.status, call.stopped])).toEqual(
      [
        ["done", undefined],
        ["error", true],
      ],
    );
  });
});
