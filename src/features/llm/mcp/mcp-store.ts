import { create } from "zustand";
import { defaultStorage, sessionStorageAdapter } from "@/infrastructure/persistence";
import {
  McpConfigRepository,
  isBlockedMode,
  isToolBlocked,
  slugifyServerId,
  validateServerUrl,
  type McpServerConfig,
  type McpToolMode,
  type McpUrlError,
} from "./mcp-connections";
import {
  isConnectedStatus,
  type McpConnectionError,
  type McpServerStatus,
  type McpToolEntry,
} from "./mcp-types";
import type { ToolDefinition } from "../tools/registry";

/**
 * MCP servers: their config, live status and tools. Light on purpose: the
 * SDK and everything that talks to a server load lazily (`mcp-runtime`), only
 * once an enabled server needs connecting.
 */

type McpRuntime = typeof import("./mcp-runtime");
type ServerConnection = InstanceType<McpRuntime["McpServerConnection"]>;

export interface McpServerDraft {
  name: string;
  url: string;
  rememberToken: boolean;
  enabled?: boolean;
}

export type McpSaveResult =
  { ok: true; server: McpServerConfig } | { ok: false; urlError?: McpUrlError; message?: string };

export type McpTestResult =
  { ok: true; toolCount: number; latencyMs: number } | { ok: false; error: McpConnectionError };

export interface McpServerRuntimeState {
  status: McpServerStatus;
  /** Every listed tool, blocked or not, for settings. */
  tools: McpToolEntry[];
  /** The registry definitions of the supported tools, blocked or not. */
  definitions: ToolDefinition[];
}

export interface McpStoreState {
  servers: McpServerConfig[];
  runtime: Record<string, McpServerRuntimeState>;
  /** Whether a token is available right now, per server. */
  tokenAvailable: Record<string, boolean>;
  loaded: boolean;

  load: () => Promise<void>;
  addServer: (draft: McpServerDraft, token: string | null) => Promise<McpSaveResult>;
  /** `token` undefined keeps the current one; null removes it. */
  updateServer: (
    id: string,
    draft: McpServerDraft,
    token: string | null | undefined,
  ) => Promise<McpSaveResult>;
  deleteServer: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  setToolMode: (id: string, toolName: string, mode: McpToolMode) => Promise<void>;
  setToken: (id: string, token: string | null) => Promise<void>;
  /** The chat panel opened: connect every enabled server. */
  connectAll: () => Promise<void>;
  /** The chat panel closed (or the page is unloading): close every session. */
  disconnectAll: () => Promise<void>;
  /** Re-lists one server's tools. */
  refresh: (id: string) => Promise<void>;
  /** Connects to an unsaved server, lists its tools, and disconnects. */
  testConnection: (url: string, token: string | null) => Promise<McpTestResult>;
  /** The tools a turn may offer: connected, enabled servers, supported and not blocked. */
  toolDefinitionsForTurn: () => ToolDefinition[];
  /** The server's stored token, for testing an edit without retyping it. */
  getToken: (id: string) => Promise<string | null>;
}

const DISCONNECTED: McpServerStatus = { state: "disconnected" };
const EMPTY_RUNTIME: McpServerRuntimeState = { status: DISCONNECTED, tools: [], definitions: [] };

export interface McpStoreDeps {
  repository: McpConfigRepository;
  loadRuntime: () => Promise<McpRuntime>;
  now?: () => number;
  /** Replaces the global fetch for MCP requests (tests). */
  fetch?: typeof fetch;
}

export function createMcpStore(deps: McpStoreDeps) {
  const { repository, loadRuntime } = deps;
  const now = deps.now ?? (() => performance.now());

  return create<McpStoreState>((set, get) => {
    const connections = new Map<string, ServerConnection>();
    /** Whether the chat panel is open; connecting only happens while it is. */
    let active = false;
    let unloadListening = false;

    const setRuntime = (id: string, patch: Partial<McpServerRuntimeState>) =>
      set((state) => ({
        runtime: {
          ...state.runtime,
          [id]: { ...(state.runtime[id] ?? EMPTY_RUNTIME), ...patch },
        },
      }));

    const findServer = (id: string) => get().servers.find((server) => server.id === id);

    const persist = async (servers: McpServerConfig[]) => {
      set({ servers });
      await repository.saveServers(servers);
    };

    const closeServer = async (id: string) => {
      const connection = connections.get(id);
      connections.delete(id);
      await connection?.close();
    };

    /** Registry entries for a server's listed tools; calls go through its live session. */
    const listInto = (
      runtime: McpRuntime,
      server: McpServerConfig,
      listed: Awaited<ReturnType<ServerConnection["connect"]>>,
    ) => {
      const built = runtime.buildMcpTools(server.id, listed, (name, args, signal) =>
        callTool(server.id, name, args, signal),
      );
      return { tools: built.entries, definitions: built.definitions };
    };

    /** Runs one call on a server's session, keeping its status in step. */
    const callTool = async (
      id: string,
      name: string,
      args: Record<string, unknown>,
      signal?: AbortSignal,
    ) => {
      const connection = connections.get(id);
      const runtime = await loadRuntime();
      if (!connection) throw new runtime.McpCallError({ kind: "network" });
      try {
        return await connection.callTool(name, args, signal);
      } catch (error) {
        if (error instanceof runtime.McpCallError) {
          setRuntime(id, { status: { state: "error", error: error.classified } });
        }
        throw error;
      }
    };

    const connectServer = async (server: McpServerConfig) => {
      await closeServer(server.id);
      const token = await repository.getToken(server);
      set((state) => ({
        tokenAvailable: { ...state.tokenAvailable, [server.id]: token !== null },
      }));
      if (server.hasToken && !token) {
        setRuntime(server.id, { status: { state: "error", error: { kind: "tokenMissing" } } });
        return;
      }
      setRuntime(server.id, { status: { state: "connecting" } });
      const runtime = await loadRuntime();
      const connection = new runtime.McpServerConnection({
        url: server.url,
        token,
        onToolsChanged: () => void get().refresh(server.id),
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      });
      const started = now();
      try {
        const listed = await connection.connect();
        // The panel closed, or the server was disabled, while this connected.
        if (!active || !findServer(server.id)?.enabled) {
          await connection.close();
          setRuntime(server.id, { status: DISCONNECTED });
          return;
        }
        connections.set(server.id, connection);
        const { tools, definitions } = listInto(runtime, server, listed);
        setRuntime(server.id, {
          status: { state: "connected", latencyMs: Math.round(now() - started) },
          tools,
          definitions,
        });
      } catch (error) {
        setRuntime(server.id, {
          status: {
            state: "error",
            error: error instanceof runtime.McpCallError ? error.classified : { kind: "network" },
          },
          definitions: [],
        });
      }
    };

    const listenForUnload = () => {
      if (unloadListening || typeof window === "undefined") return;
      unloadListening = true;
      window.addEventListener("pagehide", () => void get().disconnectAll());
    };

    const validate = (draft: McpServerDraft): McpUrlError | null => validateServerUrl(draft.url);

    return {
      servers: [],
      runtime: {},
      tokenAvailable: {},
      loaded: false,

      load: async () => {
        const servers = await repository.loadServers();
        const tokens = await Promise.all(servers.map((server) => repository.getToken(server)));
        set({
          servers,
          tokenAvailable: Object.fromEntries(
            servers.map((server, index) => [server.id, tokens[index] !== null]),
          ),
          loaded: true,
        });
      },

      addServer: async (draft, token) => {
        const urlError = validate(draft);
        if (urlError) return { ok: false, urlError };
        const server: McpServerConfig = {
          id: slugifyServerId(
            draft.name,
            get().servers.map((existing) => existing.id),
          ),
          name: draft.name.trim(),
          url: draft.url.trim(),
          enabled: draft.enabled ?? true,
          rememberToken: draft.rememberToken,
          toolModes: {},
          hasToken: Boolean(token),
        };
        try {
          await repository.setToken(server, token);
          await persist([...get().servers, server]);
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
        set((state) => ({
          tokenAvailable: { ...state.tokenAvailable, [server.id]: Boolean(token) },
        }));
        if (active && server.enabled) await connectServer(server);
        return { ok: true, server };
      },

      updateServer: async (id, draft, token) => {
        const current = findServer(id);
        if (!current) return { ok: false };
        const urlError = validate(draft);
        if (urlError) return { ok: false, urlError };
        const nextToken = token === undefined ? await repository.getToken(current) : token;
        const next: McpServerConfig = {
          ...current,
          name: draft.name.trim(),
          url: draft.url.trim(),
          rememberToken: draft.rememberToken,
          ...(draft.enabled !== undefined ? { enabled: draft.enabled } : {}),
          hasToken: token === undefined ? current.hasToken : Boolean(token),
        };
        try {
          // Moves (or replaces) the token; "remember" off deletes the persisted copy.
          await repository.setToken(next, nextToken);
          await persist(get().servers.map((server) => (server.id === id ? next : server)));
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
        set((state) => ({ tokenAvailable: { ...state.tokenAvailable, [id]: nextToken !== null } }));
        if (active && next.enabled) await connectServer(next);
        return { ok: true, server: next };
      },

      deleteServer: async (id) => {
        await closeServer(id);
        await repository.deleteToken(id);
        await persist(get().servers.filter((server) => server.id !== id));
        set((state) => {
          const runtime = { ...state.runtime };
          delete runtime[id];
          const tokenAvailable = { ...state.tokenAvailable };
          delete tokenAvailable[id];
          return { runtime, tokenAvailable };
        });
      },

      setEnabled: async (id, enabled) => {
        const current = findServer(id);
        if (!current) return;
        const next = { ...current, enabled };
        await persist(get().servers.map((server) => (server.id === id ? next : server)));
        if (!enabled) {
          await closeServer(id);
          setRuntime(id, { status: DISCONNECTED, definitions: [] });
        } else if (active) {
          await connectServer(next);
        }
      },

      setToolMode: async (id, toolName, mode) => {
        const current = findServer(id);
        if (!current) return;
        const toolModes = { ...current.toolModes };
        if (isBlockedMode(mode)) toolModes[toolName] = mode;
        else delete toolModes[toolName];
        await persist(
          get().servers.map((server) => (server.id === id ? { ...current, toolModes } : server)),
        );
      },

      setToken: async (id, token) => {
        const current = findServer(id);
        if (!current) return;
        await get().updateServer(
          id,
          { name: current.name, url: current.url, rememberToken: current.rememberToken },
          token,
        );
      },

      connectAll: async () => {
        active = true;
        listenForUnload();
        if (!get().loaded) await get().load();
        const enabled = get().servers.filter((server) => server.enabled);
        // No enabled server: the SDK is never loaded.
        await Promise.all(enabled.map((server) => connectServer(server)));
      },

      disconnectAll: async () => {
        active = false;
        const ids = [...connections.keys()];
        await Promise.all(ids.map((id) => closeServer(id)));
        set((state) => ({
          runtime: Object.fromEntries(
            Object.entries(state.runtime).map(([id, entry]) => [
              id,
              { ...entry, status: DISCONNECTED, definitions: [] },
            ]),
          ),
        }));
      },

      refresh: async (id) => {
        const server = findServer(id);
        const connection = connections.get(id);
        if (!server) return;
        if (!connection) {
          if (active && server.enabled) await connectServer(server);
          return;
        }
        const runtime = await loadRuntime();
        try {
          const listed = await connection.listTools();
          const { tools, definitions } = listInto(runtime, server, listed);
          setRuntime(id, { tools, definitions });
        } catch (error) {
          setRuntime(id, {
            status: {
              state: "error",
              error: error instanceof runtime.McpCallError ? error.classified : { kind: "network" },
            },
            definitions: [],
          });
        }
      },

      testConnection: async (url, token) => {
        if (validateServerUrl(url)) return { ok: false, error: { kind: "protocol" } };
        const runtime = await loadRuntime();
        const connection = new runtime.McpServerConnection({
          url: url.trim(),
          token,
          ...(deps.fetch ? { fetch: deps.fetch } : {}),
        });
        const started = now();
        try {
          const listed = await connection.connect();
          return { ok: true, toolCount: listed.length, latencyMs: Math.round(now() - started) };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof runtime.McpCallError ? error.classified : { kind: "network" },
          };
        } finally {
          await connection.close();
        }
      },

      getToken: async (id) => {
        const server = findServer(id);
        return server ? repository.getToken(server) : null;
      },

      toolDefinitionsForTurn: () => {
        const { servers, runtime } = get();
        return servers.flatMap((server) => {
          const entry = runtime[server.id];
          if (!entry || !server.enabled || !isConnectedStatus(entry.status)) return [];
          const blocked = new Set(
            entry.tools
              .filter((tool) => isToolBlocked(server, tool.name))
              .map((tool) => tool.registryName),
          );
          return entry.definitions.filter((definition) => !blocked.has(definition.name));
        });
      },
    };
  });
}

/** The app's MCP servers, over the default storage ports. */
export const useMcpStore = createMcpStore({
  repository: new McpConfigRepository(defaultStorage, sessionStorageAdapter),
  loadRuntime: () => import("./mcp-runtime"),
});
