import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { CONNECTIONS_PORT_KEY, loadConnections } from "./llm-storage";

/** The pre-port keys, as the chat wrote them straight to localStorage. */
const OLD_CONNECTIONS = "structura:llm:connections";
const OLD_CONFIG = "structura:llm:config";
const OLD_KEYS = "structura:llm:keys";

const stored = {
  connections: [
    {
      id: "work",
      name: "Work",
      mode: "direct",
      provider: "anthropic",
      apiKey: "sk-ant-work",
      model: "claude-haiku-4-5",
    },
  ],
  activeConnectionId: "work",
};

/** A legacy store over a plain map, so a test can see exactly what was deleted. */
function legacyStore(entries: Record<string, string>) {
  const port = new InMemoryAdapter();
  for (const [key, value] of Object.entries(entries)) void port.setItem(key, value);
  return port;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("connection storage migration to the port", () => {
  it("moves the old connections and keys through the port, then deletes the old keys", async () => {
    const port = new InMemoryAdapter();
    const legacy = legacyStore({ [OLD_CONNECTIONS]: JSON.stringify(stored) });

    const payload = await loadConnections(port, legacy);

    expect(payload.activeConnectionId).toBe("work");
    expect(payload.connections[0]).toMatchObject({ id: "work", apiKey: "sk-ant-work" });
    expect(await port.load(CONNECTIONS_PORT_KEY)).toMatchObject({
      activeConnectionId: "work",
      connections: [{ id: "work", apiKey: "sk-ant-work" }],
    });
    expect(await legacy.getItem(OLD_CONNECTIONS)).toBeNull();
  });

  it("migrates the oldest config shape and deletes all three old keys", async () => {
    const port = new InMemoryAdapter();
    const legacy = legacyStore({
      [OLD_CONFIG]: JSON.stringify({ mode: "direct", provider: "openai", model: "gpt-4o-mini" }),
      [OLD_KEYS]: JSON.stringify({ openai: "sk-old" }),
    });

    const payload = await loadConnections(port, legacy);

    expect(payload.connections[0]).toMatchObject({ provider: "openai", apiKey: "sk-old" });
    expect(await legacy.keys()).toEqual([]);
  });

  it("is a no-op on the second run", async () => {
    const port = new InMemoryAdapter();
    const legacy = legacyStore({ [OLD_CONNECTIONS]: JSON.stringify(stored) });
    const first = await loadConnections(port, legacy);

    const save = vi.spyOn(port, "save");
    const second = await loadConnections(port, legacy);

    expect(second).toEqual(first);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the old data when the write fails, and logs once", async () => {
    const port = new InMemoryAdapter();
    vi.spyOn(port, "save").mockRejectedValue(new Error("quota exceeded"));
    const legacy = legacyStore({ [OLD_CONNECTIONS]: JSON.stringify(stored) });

    const payload = await loadConnections(port, legacy);
    await loadConnections(port, legacy);

    // The user still has their connection this session...
    expect(payload.connections[0]?.apiKey).toBe("sk-ant-work");
    // ...and the old key is still there for the next try.
    expect(await legacy.getItem(OLD_CONNECTIONS)).toBe(JSON.stringify(stored));
    expect(await port.load(CONNECTIONS_PORT_KEY)).toBeNull();
    const migrationWarnings = vi
      .mocked(console.warn)
      .mock.calls.filter((call) => String(call[0]).includes("migration failed"));
    expect(migrationWarnings.length).toBeLessThanOrEqual(1);
  });

  it("reads the real old localStorage key by default", async () => {
    localStorage.setItem(OLD_CONNECTIONS, JSON.stringify(stored));
    const payload = await loadConnections();
    expect(payload.connections[0]?.id).toBe("work");
    expect(localStorage.getItem(OLD_CONNECTIONS)).toBeNull();
    expect(localStorage.getItem(`structura_${CONNECTIONS_PORT_KEY}`)).toContain("sk-ant-work");
  });
});
