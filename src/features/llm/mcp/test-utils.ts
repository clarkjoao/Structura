import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import type { McpCallResult, McpToolInfo } from "./mcp-types";

/**
 * A fake Streamable HTTP MCP server, as a `fetch` the SDK's transport can use.
 * Answers JSON-RPC with plain JSON responses; tests tweak its behavior.
 */
export interface FakeMcpServer {
  fetch: typeof fetch;
  tools: Array<Omit<McpToolInfo, "annotations"> & { annotations?: McpToolInfo["annotations"] }>;
  /** Tools per `tools/list` page; 0 means one page. */
  pageSize: number;
  /** Answers a `tools/call`. */
  onCall: (name: string, args: unknown) => McpCallResult | Promise<McpCallResult>;
  /** Every JSON-RPC method received, in order. */
  methods: string[];
  /** Authorization headers received. */
  authHeaders: Array<string | null>;
  /** Forces the next responses' HTTP status (e.g. 401, 404). */
  failWith: number | null;
  /** Answers 404 to the next request carrying a session id (an expired session). */
  expireSessionOnce: boolean;
  protocolVersion: string;
  sessions: number;
  deletes: number;
}

export function fakeMcpServer(): FakeMcpServer {
  let sessionCounter = 0;
  const server: FakeMcpServer = {
    tools: [],
    pageSize: 0,
    onCall: () => ({ content: [{ type: "text", text: "ok" }] }),
    methods: [],
    authHeaders: [],
    failWith: null,
    expireSessionOnce: false,
    protocolVersion: LATEST_PROTOCOL_VERSION,
    sessions: 0,
    deletes: 0,
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      server.authHeaders.push(headers.get("authorization"));
      if (server.failWith !== null) return new Response("nope", { status: server.failWith });
      if (init?.method === "GET") return new Response(null, { status: 405 });
      if (init?.method === "DELETE") {
        server.deletes += 1;
        return new Response(null, { status: 200 });
      }
      if (server.expireSessionOnce && headers.get("mcp-session-id")) {
        server.expireSessionOnce = false;
        return new Response("session expired", { status: 404 });
      }
      const message = JSON.parse(String(init?.body)) as {
        id?: number;
        method: string;
        params?: Record<string, unknown>;
      };
      server.methods.push(message.method);
      if (message.id === undefined) return new Response(null, { status: 202 });

      const reply = (result: unknown, extraHeaders: Record<string, string> = {}) =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }), {
          status: 200,
          headers: { "content-type": "application/json", ...extraHeaders },
        });

      if (message.method === "initialize") {
        sessionCounter += 1;
        server.sessions += 1;
        return reply(
          {
            protocolVersion: server.protocolVersion,
            capabilities: { tools: { listChanged: true } },
            serverInfo: { name: "fake", version: "1.0.0" },
          },
          { "mcp-session-id": `session-${sessionCounter}` },
        );
      }
      if (message.method === "tools/list") {
        const size = server.pageSize || server.tools.length || 1;
        const start = Number(message.params?.cursor ?? 0);
        const page = server.tools.slice(start, start + size);
        const next = start + size < server.tools.length ? String(start + size) : undefined;
        return reply({ tools: page, ...(next ? { nextCursor: next } : {}) });
      }
      if (message.method === "tools/call") {
        const result = await server.onCall(String(message.params?.name), message.params?.arguments);
        return reply(result);
      }
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: "not found" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  };
  return server;
}

export const echoTool = {
  name: "echo",
  description: "Echoes text.",
  inputSchema: { type: "object", properties: { text: { type: "string" } } },
};
