import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ErrorCode,
  McpError,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { LLM_REQUEST_TIMEOUT_MS } from "../errors";
import type { McpCallResult, McpConnectionError, McpErrorKind, McpToolInfo } from "./mcp-types";

/**
 * One browser-side MCP client per server, over Streamable HTTP. Loaded lazily
 * (with the SDK) only when an MCP server is enabled.
 */

const CLIENT_INFO = { name: "structura", version: "1.0.0" };

/** What the chat needs from an MCP session; the SDK client implements it. */
export interface McpSession {
  listTools(signal?: AbortSignal): Promise<McpToolInfo[]>;
  callTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<McpCallResult>;
  close(): Promise<void>;
}

export interface McpSessionOptions {
  url: string;
  token: string | null;
  /** Called when the server says its tool list changed. */
  onToolsChanged?: () => void;
  /** Replaces the global fetch (tests). */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toToolInfo(tool: {
  name: string;
  description?: string;
  inputSchema: unknown;
  annotations?: unknown;
}): McpToolInfo {
  const annotations = isRecord(tool.annotations) ? tool.annotations : {};
  const hint = (key: string) =>
    typeof annotations[key] === "boolean" ? { [key]: annotations[key] } : {};
  return {
    name: tool.name,
    ...(tool.description ? { description: tool.description } : {}),
    inputSchema: tool.inputSchema,
    annotations: {
      ...hint("readOnlyHint"),
      ...hint("destructiveHint"),
      ...hint("openWorldHint"),
    },
  };
}

/** Opens an MCP session with the SDK's client and Streamable HTTP transport. */
export async function openSdkSession(options: McpSessionOptions): Promise<McpSession> {
  const timeout = options.timeoutMs ?? LLM_REQUEST_TIMEOUT_MS;
  const transport = new StreamableHTTPClientTransport(new URL(options.url), {
    ...(options.token
      ? { requestInit: { headers: { Authorization: `Bearer ${options.token}` } } }
      : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const client = new Client(CLIENT_INFO, { capabilities: {} });
  if (options.onToolsChanged) {
    const onToolsChanged = options.onToolsChanged;
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => onToolsChanged());
  }
  await client.connect(transport, { timeout });

  return {
    async listTools(signal) {
      const tools: McpToolInfo[] = [];
      let cursor: string | undefined;
      // Paginated: follow `nextCursor` until the server stops sending one.
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined, {
          timeout,
          ...(signal ? { signal } : {}),
        });
        tools.push(...page.tools.map(toToolInfo));
        cursor = page.nextCursor;
      } while (cursor);
      return tools;
    },

    async callTool(name, args, signal) {
      const result = await client.callTool({ name, arguments: args }, undefined, {
        timeout,
        resetTimeoutOnProgress: true,
        ...(signal ? { signal } : {}),
      });
      return {
        content: Array.isArray(result.content) ? result.content : [],
        ...(result.structuredContent !== undefined
          ? { structuredContent: result.structuredContent }
          : {}),
        ...(result.isError === true ? { isError: true } : {}),
      };
    },

    async close() {
      try {
        await transport.terminateSession();
      } catch {
        // The server may not support explicit termination (405) or be gone.
      }
      await client.close();
    },
  };
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** HTTP statuses that mean the endpoint does not speak Streamable HTTP as expected. */
const PROTOCOL_STATUSES = new Set([400, 405, 406, 415]);

function httpKind(status: number | undefined): McpErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "notFound";
  // -1: the SDK's "unexpected content type", i.e. not an MCP endpoint.
  if (status === undefined || status < 0 || PROTOCOL_STATUSES.has(status)) return "protocol";
  return "network";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException;
}

/**
 * What went wrong, by error type and HTTP status, never by message text:
 * - `cors`: fetch failed with no response while online (the browser hides a
 *   blocked cross-origin response behind the same TypeError);
 * - `auth`: 401/403, or the SDK's UnauthorizedError;
 * - `notFound`: 404;
 * - `protocol`: a bad handshake, an unsupported protocol version, a non-MCP
 *   response, or a JSON-RPC error;
 * - `network`: offline, timed out, connection closed, or a server error.
 */
export function classifyMcpError(
  error: unknown,
  online: boolean = typeof navigator === "undefined" ? true : navigator.onLine,
): McpConnectionError {
  if (error instanceof UnauthorizedError) return { kind: "auth" };
  if (error instanceof StreamableHTTPError) {
    return {
      kind: httpKind(error.code),
      ...(error.code !== undefined && error.code > 0 ? { status: error.code } : {}),
    };
  }
  if (error instanceof McpError) {
    return error.code === ErrorCode.RequestTimeout || error.code === ErrorCode.ConnectionClosed
      ? { kind: "network" }
      : { kind: "protocol" };
  }
  if (error instanceof TypeError) return { kind: online ? "cors" : "network" };
  if (isAbortError(error)) return { kind: "network" };
  // Anything else thrown while talking to the server is the handshake or a
  // response the SDK could not accept (e.g. an unsupported protocol version).
  return { kind: "protocol" };
}

/** A session the server forgot (404 on a known session) or a closed connection. */
function isDroppedSession(error: unknown): boolean {
  return (
    (error instanceof StreamableHTTPError && error.code === 404) ||
    (error instanceof McpError && error.code === ErrorCode.ConnectionClosed)
  );
}

/** A user abort: not a server failure, so it is passed through untouched. */
export function isCallAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

export class McpCallError extends Error {
  constructor(readonly classified: McpConnectionError) {
    super(`MCP server unavailable (${classified.kind})`);
    this.name = "McpCallError";
  }
}

// ─── Connection ───────────────────────────────────────────────────────────────

export type SessionOpener = (options: McpSessionOptions) => Promise<McpSession>;

/**
 * A server's live session: connects, lists tools, calls them, and reconnects
 * once when the session drops before giving up.
 */
export class McpServerConnection {
  private session: McpSession | null = null;

  constructor(
    private readonly options: McpSessionOptions,
    private readonly open: SessionOpener = openSdkSession,
  ) {}

  /** Connects and lists the tools. Throws an McpCallError with the classified cause. */
  async connect(): Promise<McpToolInfo[]> {
    try {
      this.session = await this.open(this.options);
      return await this.session.listTools();
    } catch (error) {
      await this.close();
      throw new McpCallError(classifyMcpError(error));
    }
  }

  async listTools(): Promise<McpToolInfo[]> {
    return this.withReconnect((session) => session.listTools());
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<McpCallResult> {
    return this.withReconnect((session) => session.callTool(name, args, signal), signal);
  }

  async close(): Promise<void> {
    const session = this.session;
    this.session = null;
    await session?.close().catch(() => undefined);
  }

  private async withReconnect<T>(
    run: (session: McpSession) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    try {
      const session = this.session ?? (await this.open(this.options));
      this.session = session;
      return await run(session);
    } catch (error) {
      if (isCallAborted(signal)) throw error;
      if (!isDroppedSession(error)) throw new McpCallError(classifyMcpError(error));
    }
    // Once: a fresh session, then the same call again.
    await this.close();
    try {
      this.session = await this.open(this.options);
      return await run(this.session);
    } catch (error) {
      if (isCallAborted(signal)) throw error;
      throw new McpCallError(classifyMcpError(error));
    }
  }
}
