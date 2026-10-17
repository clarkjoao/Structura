import type { IStoragePort } from "@/infrastructure/persistence";

/**
 * Remote MCP servers the chat connects to from the browser (Streamable HTTP).
 * The config is persisted through the storage port; the bearer token lives in
 * session storage unless the user asks to remember it on this browser.
 */

export type McpToolMode = "auto" | "blocked";

export interface McpServerConfig {
  /** Slug of the name at creation: lowercase `[a-z0-9_]`, unique, never changes. */
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  /** Keep the token in persistent browser storage instead of the session. */
  rememberToken: boolean;
  /** Per tool (by the server's own tool name). Absent means "auto". */
  toolModes: Record<string, McpToolMode>;
  /**
   * The user gave this server a token. Lets the chat tell "no token needed"
   * from "the session token is gone" (after a browser restart).
   */
  hasToken: boolean;
}

export function isBlockedMode(mode: McpToolMode | undefined): mode is "blocked" {
  return mode === "blocked";
}

export function isToolBlocked(server: McpServerConfig, toolName: string): boolean {
  return isBlockedMode(server.toolModes[toolName]);
}

// ─── Ids ──────────────────────────────────────────────────────────────────────

/** The id for a new server called `name`, unique among `existingIds`. */
export function slugifyServerId(name: string, existingIds: Iterable<string>): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "server";
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// ─── URLs ─────────────────────────────────────────────────────────────────────

export type McpUrlError = "invalid" | "insecure";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * `https://` only, except plain `http://` on localhost and 127.0.0.1 (a server
 * running on the user's own machine). Null when the URL is acceptable.
 */
export function validateServerUrl(raw: string): McpUrlError | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "invalid";
  }
  if (url.protocol === "https:") return null;
  if (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) return null;
  return url.protocol === "http:" ? "insecure" : "invalid";
}

export const MCP_URL_ERROR_KEYS: Record<McpUrlError, string> = {
  invalid: "llmChat.mcp.form.urlInvalid",
  insecure: "llmChat.mcp.form.urlInsecure",
};

// ─── Persistence ──────────────────────────────────────────────────────────────

const SERVERS_KEY = "llm-mcp-servers";
const tokenKey = (serverId: string) => `llm-mcp-token:${serverId}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toolModesOf(value: unknown): Record<string, McpToolMode> {
  if (!isRecord(value)) return {};
  const modes: Record<string, McpToolMode> = {};
  for (const [tool, mode] of Object.entries(value)) {
    if (mode === "blocked") modes[tool] = "blocked";
  }
  return modes;
}

function parseServer(value: unknown): McpServerConfig | null {
  if (!isRecord(value)) return null;
  const { id, name, url } = value;
  if (typeof id !== "string" || typeof name !== "string" || typeof url !== "string") return null;
  return {
    id,
    name,
    url,
    enabled: value.enabled === true,
    rememberToken: value.rememberToken === true,
    toolModes: toolModesOf(value.toolModes),
    hasToken: value.hasToken === true,
  };
}

/** Server configs and their tokens, over a persistent and a session-scoped port. */
export class McpConfigRepository {
  constructor(
    private readonly port: IStoragePort,
    private readonly sessionPort: IStoragePort,
  ) {}

  async loadServers(): Promise<McpServerConfig[]> {
    const stored = await this.port.load<unknown>(SERVERS_KEY);
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((entry) => {
      const server = parseServer(entry);
      return server ? [server] : [];
    });
  }

  async saveServers(servers: readonly McpServerConfig[]): Promise<void> {
    await this.port.save(SERVERS_KEY, servers);
  }

  /** The token, from wherever the server keeps it; null when there is none. */
  async getToken(server: Pick<McpServerConfig, "id" | "rememberToken">): Promise<string | null> {
    const store = server.rememberToken ? this.port : this.sessionPort;
    const token = await store.getItem(tokenKey(server.id));
    return token && token.length > 0 ? token : null;
  }

  /** Stores (or, with null, removes) the token where the server keeps it. */
  async setToken(
    server: Pick<McpServerConfig, "id" | "rememberToken">,
    token: string | null,
  ): Promise<void> {
    if (server.rememberToken) {
      // Only one copy: a remembered token is not also in the session.
      await this.sessionPort.removeItem(tokenKey(server.id));
      if (token) await this.port.setItem(tokenKey(server.id), token);
      else await this.port.removeItem(tokenKey(server.id));
      return;
    }
    // Turning "remember" off (or never having it) leaves no persisted copy.
    await this.port.removeItem(tokenKey(server.id));
    if (token) await this.sessionPort.setItem(tokenKey(server.id), token);
    else await this.sessionPort.removeItem(tokenKey(server.id));
  }

  /** Moves the token between session and persistent storage. */
  async setRememberToken(
    server: Pick<McpServerConfig, "id" | "rememberToken">,
    rememberToken: boolean,
  ): Promise<void> {
    const token = await this.getToken(server);
    await this.setToken({ id: server.id, rememberToken }, token);
  }

  async deleteToken(serverId: string): Promise<void> {
    await this.port.removeItem(tokenKey(serverId));
    await this.sessionPort.removeItem(tokenKey(serverId));
  }
}
