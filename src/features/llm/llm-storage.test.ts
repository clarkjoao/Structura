import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PROXY_BASE_URL,
  deriveThreadTitle,
  hydrateChatThreadsCacheFromIdb,
  getChatThreadsCache,
  isChatThreadsHydrated,
  isUsableConnection,
  loadConnections,
  loadThreadsForDiagram,
  migrateLegacyConfig,
  migrateLegacyThreads,
  resetLLMStorageForTests,
  saveConnections,
  saveThreadsForDiagram,
  setChatThreadsCacheEntry,
  setChatThreadsHydrated,
} from "./llm-storage";

const LLM_CONNECTIONS_KEY = "structura:llm:connections";
const LLM_CONFIG_KEY = "structura:llm:config";
const PROVIDER_KEYS_KEY = "structura:llm:keys";
const HISTORY_KEY = "structura:llm:history";

function clearLocalStorage() {
  localStorage.clear();
}

beforeEach(() => {
  clearLocalStorage();
  resetLLMStorageForTests();
});

afterEach(() => {
  clearLocalStorage();
  resetLLMStorageForTests();
});

describe("llm-storage", () => {
  describe("migrateLegacyConfig", () => {
    it("preserves direct + openai + apiKey + model + falls back through keys", () => {
      const result = migrateLegacyConfig(
        JSON.stringify({
          mode: "direct",
          provider: "openai",
          apiKey: "sk-from-config",
          model: "gpt-4o",
        }),
        JSON.stringify({ openai: "sk-from-keys", anthropic: "sk-ant" }),
      );
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0]).toMatchObject({
        mode: "direct",
        provider: "openai",
        apiKey: "sk-from-config",
        model: "gpt-4o",
      });
      expect(result.activeConnectionId).toBe(result.connections[0].id);
    });

    it("falls back to provider-key payload when legacy config has no apiKey", () => {
      const result = migrateLegacyConfig(
        JSON.stringify({ mode: "direct", provider: "anthropic", model: "claude-haiku-4-5" }),
        JSON.stringify({ anthropic: "sk-ant-fallback", openai: "" }),
      );
      expect(result.connections[0]).toMatchObject({
        provider: "anthropic",
        apiKey: "sk-ant-fallback",
        model: "claude-haiku-4-5",
      });
    });

    it("returns proxy/openai defaults for empty inputs", () => {
      const result = migrateLegacyConfig(null, null);
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0]).toMatchObject({
        mode: "proxy",
        provider: "openai",
        apiKey: "",
        model: "gpt-4o-mini",
      });
    });

    it("ignores malformed JSON", () => {
      const result = migrateLegacyConfig("not json", "{");
      expect(result.connections[0].provider).toBe("openai");
    });
  });

  describe("migrateLegacyThreads", () => {
    it("converts legacy single-thread payload into a new-shape diagram entry", () => {
      const legacy = JSON.stringify({
        "diagram-1": {
          diagramId: "diagram-1",
          updatedAt: 1700000000000,
          messages: [
            { id: "m1", role: "user", content: "Add a database", timestamp: 1700000000000 },
            { id: "m2", role: "assistant", content: "ok", timestamp: 1700000000001 },
          ],
        },
      });
      const result = migrateLegacyThreads(legacy);
      expect(Object.keys(result)).toEqual(["diagram-1"]);
      const entry = result["diagram-1"];
      expect(entry.threads).toHaveLength(1);
      expect(entry.threads[0]).toMatchObject({
        diagramId: "diagram-1",
        messages: [
          { id: "m1", role: "user" },
          { id: "m2", role: "assistant" },
        ],
      });
      expect(entry.threads[0].title).toBe("Add a database");
      expect(entry.activeThreadId).toBe(entry.threads[0].id);
    });

    it("returns {} for missing legacy data", () => {
      expect(migrateLegacyThreads(null)).toEqual({});
    });

    it("is idempotent over new-shape data", () => {
      const diagramId = "diagram-2";
      const threadId = "thread-2";
      const state = {
        [diagramId]: {
          threads: [
            {
              id: threadId,
              diagramId,
              title: "Existing",
              messages: [{ id: "a", role: "user", content: "hi", timestamp: 1 }],
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          activeThreadId: threadId,
        },
      };
      const firstPass = migrateLegacyThreads(JSON.stringify(state));
      const secondPass = migrateLegacyThreads(JSON.stringify(firstPass));
      expect(secondPass[diagramId].threads[0].id).toBe(threadId);
      expect(secondPass[diagramId].threads[0].messages).toEqual(
        firstPass[diagramId].threads[0].messages,
      );
    });
  });

  describe("loadConnections / saveConnections", () => {
    it("returns a single direct/openai default connection with no key when storage is empty", () => {
      const payload = loadConnections();
      expect(payload.connections).toHaveLength(1);
      expect(payload.connections[0]).toMatchObject({
        mode: "direct",
        provider: "openai",
        apiKey: "",
        model: "gpt-4o-mini",
      });
      expect(payload.activeConnectionId).toBe(payload.connections[0].id);
      // A fresh install has nothing to send with, so the chat opens settings.
      expect(isUsableConnection(payload.connections[0])).toBe(false);
    });

    it("leaves a stored proxy connection in proxy mode", () => {
      localStorage.setItem(
        LLM_CONNECTIONS_KEY,
        JSON.stringify({
          connections: [
            { id: "stored", name: "Team proxy", mode: "proxy", provider: "openai", apiKey: "" },
          ],
          activeConnectionId: "stored",
        }),
      );
      expect(loadConnections().connections[0]).toMatchObject({ id: "stored", mode: "proxy" });
    });

    it("migrates stored connections to the AI SDK transport's base URLs", () => {
      localStorage.setItem(
        LLM_CONNECTIONS_KEY,
        JSON.stringify({
          connections: [
            { id: "p", name: "Proxy", mode: "proxy", provider: "openai", apiKey: "", model: "m" },
            {
              id: "c",
              name: "Local",
              mode: "direct",
              provider: "custom",
              apiKey: "",
              model: "llama",
              baseUrl: "http://localhost:11434/v1/chat/completions",
            },
          ],
          activeConnectionId: "p",
        }),
      );
      const [proxy, custom] = loadConnections().connections;
      expect(proxy?.baseUrl).toBe(DEFAULT_PROXY_BASE_URL);
      expect(custom?.baseUrl).toBe("http://localhost:11434/v1");
    });

    it("isUsableConnection: proxy always, direct needs a key, custom needs url + model", () => {
      const base = { apiKey: "", model: "m" } as const;
      expect(isUsableConnection({ ...base, mode: "proxy", provider: "openai" })).toBe(true);
      expect(isUsableConnection({ ...base, mode: "direct", provider: "openai" })).toBe(false);
      expect(
        isUsableConnection({ ...base, mode: "direct", provider: "anthropic", apiKey: "k" }),
      ).toBe(true);
      expect(isUsableConnection({ ...base, mode: "direct", provider: "custom" })).toBe(false);
      expect(
        isUsableConnection({
          ...base,
          mode: "direct",
          provider: "custom",
          baseUrl: "https://llm.example.com/v1",
        }),
      ).toBe(true);
    });

    it("does not migrate twice once new shape exists", () => {
      localStorage.setItem(
        LLM_CONNECTIONS_KEY,
        JSON.stringify({
          connections: [
            {
              id: "kept",
              name: "Kept",
              mode: "direct",
              provider: "anthropic",
              apiKey: "ant",
              model: "claude-haiku-4-5",
            },
          ],
          activeConnectionId: "kept",
        }),
      );
      localStorage.setItem(
        LLM_CONFIG_KEY,
        JSON.stringify({ mode: "direct", provider: "openai", apiKey: "should-be-ignored" }),
      );
      const payload = loadConnections();
      expect(payload.connections).toHaveLength(1);
      expect(payload.connections[0].id).toBe("kept");
      expect(payload.connections[0].apiKey).toBe("ant");
    });

    it("migrates legacy config + provider keys when new shape is missing", () => {
      localStorage.setItem(
        LLM_CONFIG_KEY,
        JSON.stringify({
          mode: "direct",
          provider: "openai",
          apiKey: "sk-mig",
          model: "gpt-4o-mini",
        }),
      );
      localStorage.setItem(PROVIDER_KEYS_KEY, JSON.stringify({ openai: "sk-mig", anthropic: "" }));
      const payload = loadConnections();
      expect(payload.connections).toHaveLength(1);
      expect(payload.connections[0]).toMatchObject({
        mode: "direct",
        provider: "openai",
        apiKey: "sk-mig",
        model: "gpt-4o-mini",
      });
    });

    it("saveConnections rejects unknown activeConnectionId and falls back", () => {
      const a = {
        id: "a",
        name: "A",
        mode: "direct" as const,
        provider: "openai" as const,
        apiKey: "",
        model: "gpt-4o-mini",
      };
      saveConnections({ connections: [a], activeConnectionId: "ghost" });
      const raw = localStorage.getItem(LLM_CONNECTIONS_KEY);
      expect(raw).toContain('"activeConnectionId":"a"');
      expect(raw).toContain('"id":"a"');
    });
  });

  describe("cache (in-memory)", () => {
    it("loadThreadsForDiagram returns from the cache when hydrated", () => {
      setChatThreadsCacheEntry("diagram-cached", {
        threads: [
          {
            id: "cached-1",
            diagramId: "diagram-cached",
            title: "Cached",
            messages: [
              { id: "m", role: "user", parts: [{ type: "text", text: "cached" }], timestamp: 1 },
            ],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        activeThreadId: "cached-1",
      });
      setChatThreadsHydrated(true);
      const state = loadThreadsForDiagram("diagram-cached");
      expect(state.threads[0]?.title).toBe("Cached");
      expect(isChatThreadsHydrated()).toBe(true);
    });

    it("loadThreadsForDiagram returns empty state on cache miss when hydrated", () => {
      setChatThreadsHydrated(true);
      const state = loadThreadsForDiagram("never-written");
      expect(state).toEqual({ threads: [], activeThreadId: "" });
    });

    it("getChatThreadsCache reflects the current state after reset", () => {
      setChatThreadsCacheEntry("d", { threads: [], activeThreadId: "" });
      expect(getChatThreadsCache()["d"]).toEqual({ threads: [], activeThreadId: "" });
      resetLLMStorageForTests();
      expect(getChatThreadsCache()).toEqual({});
      expect(isChatThreadsHydrated()).toBe(false);
    });
  });

  describe("loadThreadsForDiagram / saveThreadsForDiagram", () => {
    it("returns empty state when there is no history at all", () => {
      const state = loadThreadsForDiagram("missing");
      expect(state.threads).toEqual([]);
      expect(state.activeThreadId).toBe("");
    });

    it("preserves messages when migrating legacy per-diagram payload", () => {
      const legacy = JSON.stringify({
        "diagram-3": {
          diagramId: "diagram-3",
          updatedAt: 1700000000000,
          messages: [
            { id: "x", role: "user", content: "Bootstrap", timestamp: 1700000000000 },
            { id: "y", role: "assistant", content: "doing it", timestamp: 1700000000001 },
          ],
        },
      });
      localStorage.setItem(HISTORY_KEY, legacy);
      const state = loadThreadsForDiagram("diagram-3");
      expect(state.threads).toHaveLength(1);
      expect(state.threads[0].messages.map((m) => m.id)).toEqual(["x", "y"]);
    });

    it("saveThreadsForDiagram persists the new shape and preserves other diagrams (cache-hydrated)", () => {
      const diagramId = "diagram-save";
      const threadId = "thread-save";
      // Hydrate the cache first so saveThreadsForDiagram can include the
      // existing entry in the snapshot.
      setChatThreadsCacheEntry("other-diagram", {
        threads: [
          {
            id: "t-other",
            diagramId: "other-diagram",
            title: "Other",
            messages: [
              { id: "m1", role: "user", parts: [{ type: "text", text: "hi" }], timestamp: 1 },
            ],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        activeThreadId: "t-other",
      });
      setChatThreadsHydrated(true);
      saveThreadsForDiagram(diagramId, {
        threads: [
          {
            id: threadId,
            diagramId,
            title: "Title",
            messages: [
              { id: "a", role: "user", parts: [{ type: "text", text: "ask" }], timestamp: 5 },
            ],
            createdAt: 5,
            updatedAt: 5,
          },
        ],
        activeThreadId: threadId,
      });
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}");
      expect(raw["other-diagram"].threads[0].id).toBe("t-other");
      expect(raw[diagramId].threads[0].id).toBe(threadId);
    });

    it("saveThreadsForDiagram without hydration is blocked to prevent data loss", () => {
      // Before hydration completes, saveThreadsForDiagram is blocked to prevent
      // overwriting localStorage with partial data from an empty cache.
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify({
          "stale-legacy": {
            threads: [
              {
                id: "t-stale",
                diagramId: "stale-legacy",
                title: "Stale",
                messages: [{ id: "m1", role: "user", content: "stale", timestamp: 1 }],
                createdAt: 1,
                updatedAt: 1,
              },
            ],
            activeThreadId: "t-stale",
          },
        }),
      );
      saveThreadsForDiagram("diagram-fresh", {
        threads: [
          {
            id: "thread-fresh",
            diagramId: "diagram-fresh",
            title: "Fresh",
            messages: [
              { id: "a", role: "user", parts: [{ type: "text", text: "ask" }], timestamp: 5 },
            ],
            createdAt: 5,
            updatedAt: 5,
          },
        ],
        activeThreadId: "thread-fresh",
      });
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}");
      // Save is blocked during hydration, so the legacy data is preserved.
      expect(Object.keys(raw).sort()).toEqual(["stale-legacy"]);
    });
  });

  describe("deriveThreadTitle", () => {
    it("returns the first user message trimmed", () => {
      expect(
        deriveThreadTitle([
          {
            id: "x",
            role: "assistant",
            parts: [{ type: "text", text: "irrelevant" }],
            timestamp: 1,
          },
          {
            id: "u",
            role: "user",
            parts: [{ type: "text", text: "  Hello   World  " }],
            timestamp: 2,
          },
        ]),
      ).toBe("Hello World");
    });

    it("truncates long titles with an ellipsis at the 60-char boundary", () => {
      const long = "a".repeat(80);
      const title = deriveThreadTitle([
        { id: "u", role: "user", parts: [{ type: "text", text: long }], timestamp: 1 },
      ]);
      expect(title.length).toBe(60);
      expect(title.endsWith("…")).toBe(true);
    });

    it("returns '' when no user message exists", () => {
      expect(deriveThreadTitle([])).toBe("");
    });
  });
});

describe("llm-storage — snapshot format migration", () => {
  beforeEach(() => {
    localStorage.clear();
    resetLLMStorageForTests();
  });

  it("rewrites a legacy localStorage snapshot in the parts format after hydrating", async () => {
    localStorage.setItem(
      "structura:llm:history",
      JSON.stringify({
        "diagram-1": {
          threads: [
            {
              id: "t1",
              diagramId: "diagram-1",
              title: "Old",
              messages: [{ id: "u", role: "user", content: "Add a cache", timestamp: 1 }],
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          activeThreadId: "t1",
        },
      }),
    );

    await hydrateChatThreadsCacheFromIdb();

    expect(getChatThreadsCache()["diagram-1"]?.threads[0]?.messages[0]?.parts).toEqual([
      { type: "text", text: "Add a cache" },
    ]);
    const snapshot = JSON.parse(localStorage.getItem("structura:llm:history") ?? "{}");
    expect(snapshot["diagram-1"].threads[0].messages[0]).toEqual({
      id: "u",
      role: "user",
      parts: [{ type: "text", text: "Add a cache" }],
      timestamp: 1,
    });
    expect(localStorage.getItem("structura:llm:history:formatVersion")).toBe("2");
  });
});
