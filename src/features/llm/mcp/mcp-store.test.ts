import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { McpConfigRepository } from "./mcp-connections";
import { createMcpStore } from "./mcp-store";
import { echoTool, fakeMcpServer } from "./test-utils";

function setup(options: { session?: InMemoryAdapter; port?: InMemoryAdapter } = {}) {
  const server = fakeMcpServer();
  server.tools = [echoTool, { ...echoTool, name: "drop_table" }];
  const port = options.port ?? new InMemoryAdapter();
  const session = options.session ?? new InMemoryAdapter();
  const loadRuntime = vi.fn(() => import("./mcp-runtime"));
  const store = createMcpStore({
    repository: new McpConfigRepository(port, session),
    loadRuntime,
    fetch: server.fetch,
  });
  return { server, store, port, session, loadRuntime };
}

const draft = { name: "Fake", url: "https://mcp.example.com/mcp", rememberToken: false };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MCP store", () => {
  it("does not load the SDK while no server is enabled", async () => {
    const { store, loadRuntime } = setup();
    await store.getState().connectAll();
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it("connects enabled servers when the panel opens and lists their tools", async () => {
    const { store } = setup();
    await store.getState().addServer(draft, null);
    await store.getState().connectAll();

    const runtime = store.getState().runtime.fake;
    expect(runtime?.status.state).toBe("connected");
    expect(runtime?.tools.map((tool) => tool.registryName)).toEqual([
      "mcp__fake__echo",
      "mcp__fake__drop_table",
    ]);
    expect(
      store
        .getState()
        .toolDefinitionsForTurn()
        .map((tool) => tool.name),
    ).toEqual(["mcp__fake__echo", "mcp__fake__drop_table"]);
  });

  it("never offers blocked tools", async () => {
    const { store } = setup();
    await store.getState().addServer(draft, null);
    await store.getState().connectAll();
    await store.getState().setToolMode("fake", "drop_table", "blocked");

    expect(
      store
        .getState()
        .toolDefinitionsForTurn()
        .map((tool) => tool.name),
    ).toEqual(["mcp__fake__echo"]);
    expect(store.getState().servers[0]?.toolModes).toEqual({ drop_table: "blocked" });
  });

  it("closes every session when the panel closes and on page unload", async () => {
    const { store, server } = setup();
    await store.getState().addServer(draft, null);
    await store.getState().connectAll();

    window.dispatchEvent(new Event("pagehide"));
    await vi.waitFor(() => expect(server.deletes).toBe(1));
    expect(store.getState().runtime.fake?.status.state).toBe("disconnected");
    expect(store.getState().toolDefinitionsForTurn()).toEqual([]);
  });

  it("shows the auth state for a rejected token", async () => {
    const { store, server } = setup();
    server.failWith = 401;
    await store.getState().addServer(draft, "bad");
    await store.getState().connectAll();
    expect(store.getState().runtime.fake?.status).toEqual({
      state: "error",
      error: { kind: "auth", status: 401 },
    });
  });

  it("asks for the token again when a session token is gone after a restart", async () => {
    const port = new InMemoryAdapter();
    const first = setup({ port });
    await first.store.getState().addServer(draft, "session-only");

    // A new browser session: same persistent storage, empty session storage.
    const second = setup({ port, session: new InMemoryAdapter() });
    await second.store.getState().connectAll();

    expect(second.store.getState().runtime.fake?.status).toEqual({
      state: "error",
      error: { kind: "tokenMissing" },
    });
    expect(second.server.methods).toEqual([]);
  });

  it("a remembered token survives a restart", async () => {
    const port = new InMemoryAdapter();
    const first = setup({ port });
    await first.store.getState().addServer({ ...draft, rememberToken: true }, "kept");

    const second = setup({ port, session: new InMemoryAdapter() });
    await second.store.getState().connectAll();

    expect(second.store.getState().runtime.fake?.status.state).toBe("connected");
    expect(second.server.authHeaders).toContain("Bearer kept");
  });

  it("refresh re-lists a server's tools", async () => {
    const { store, server } = setup();
    await store.getState().addServer(draft, null);
    await store.getState().connectAll();
    server.tools = [{ ...echoTool, name: "new_tool" }];

    await store.getState().refresh("fake");

    expect(store.getState().runtime.fake?.tools.map((tool) => tool.name)).toEqual(["new_tool"]);
  });

  it("rejects an insecure URL", async () => {
    const { store } = setup();
    const result = await store.getState().addServer({ ...draft, url: "http://example.com" }, null);
    expect(result).toEqual({ ok: false, urlError: "insecure" });
    expect(store.getState().servers).toEqual([]);
  });

  it("deleting a server removes its config and token", async () => {
    const { store, port } = setup();
    await store.getState().addServer({ ...draft, rememberToken: true }, "kept");
    await store.getState().deleteServer("fake");
    expect(store.getState().servers).toEqual([]);
    expect(await port.getItem("llm-mcp-token:fake")).toBeNull();
    expect(await port.load("llm-mcp-servers")).toEqual([]);
  });

  it("tests an unsaved server: tool count and latency, or the classified error", async () => {
    const { store, server } = setup();
    const ok = await store.getState().testConnection(draft.url, null);
    expect(ok).toMatchObject({ ok: true, toolCount: 2 });

    server.failWith = 404;
    expect(await store.getState().testConnection(draft.url, null)).toEqual({
      ok: false,
      error: { kind: "notFound", status: 404 },
    });
  });
});
