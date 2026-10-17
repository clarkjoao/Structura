import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { McpCallError, McpServerConnection, classifyMcpError, openSdkSession } from "./mcp-client";
import { echoTool, fakeMcpServer } from "./test-utils";

const URL_ = "https://mcp.example.com/mcp";

function connection(server: ReturnType<typeof fakeMcpServer>, token: string | null = null) {
  return new McpServerConnection({ url: URL_, token, fetch: server.fetch }, (options) =>
    openSdkSession(options),
  );
}

async function classifiedFailure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof McpCallError) return error.classified;
    throw error;
  }
  throw new Error("expected a failure");
}

describe("McpServerConnection", () => {
  it("connects with the bearer token and lists every page of tools", async () => {
    const server = fakeMcpServer();
    server.tools = Array.from({ length: 5 }, (_, index) => ({
      ...echoTool,
      name: `tool_${index}`,
    }));
    server.pageSize = 2;

    const tools = await connection(server, "secret").connect();

    expect(tools.map((tool) => tool.name)).toEqual([
      "tool_0",
      "tool_1",
      "tool_2",
      "tool_3",
      "tool_4",
    ]);
    expect(server.methods.filter((method) => method === "tools/list")).toHaveLength(3);
    expect(server.authHeaders.every((header) => header === "Bearer secret")).toBe(true);
  });

  it("sends no Authorization header without a token", async () => {
    const server = fakeMcpServer();
    await connection(server).connect();
    expect(server.authHeaders.every((header) => header === null)).toBe(true);
  });

  it("calls a tool and returns its content", async () => {
    const server = fakeMcpServer();
    server.tools = [echoTool];
    server.onCall = (_name, args) => ({
      content: [{ type: "text", text: JSON.stringify(args) }],
    });
    const live = connection(server);
    await live.connect();
    const result = await live.callTool("echo", { text: "hi" });
    expect(result.content).toEqual([{ type: "text", text: '{"text":"hi"}' }]);
  });

  it("reconnects once when the session drops, then succeeds", async () => {
    const server = fakeMcpServer();
    server.tools = [echoTool];
    const live = connection(server);
    await live.connect();
    server.expireSessionOnce = true;

    const result = await live.callTool("echo", {});

    expect(result.content).toEqual([{ type: "text", text: "ok" }]);
    expect(server.sessions).toBe(2);
  });

  it("fails after one reconnect when the server keeps failing", async () => {
    const server = fakeMcpServer();
    const live = connection(server);
    await live.connect();
    server.failWith = 404;
    expect(await classifiedFailure(live.callTool("echo", {}))).toEqual({
      kind: "notFound",
      status: 404,
    });
  });

  it("closes the session (DELETE) on close", async () => {
    const server = fakeMcpServer();
    const live = connection(server);
    await live.connect();
    await live.close();
    expect(server.deletes).toBe(1);
  });

  it("classifies connect failures by status and error type", async () => {
    const auth = fakeMcpServer();
    auth.failWith = 401;
    expect(await classifiedFailure(connection(auth).connect())).toEqual({
      kind: "auth",
      status: 401,
    });

    const missing = fakeMcpServer();
    missing.failWith = 404;
    expect(await classifiedFailure(connection(missing).connect())).toMatchObject({
      kind: "notFound",
    });

    const oldProtocol = fakeMcpServer();
    oldProtocol.protocolVersion = "1999-01-01";
    expect(await classifiedFailure(connection(oldProtocol).connect())).toEqual({
      kind: "protocol",
    });

    // What a browser shows for a cross-origin response without CORS headers.
    const blocked = new McpServerConnection({
      url: URL_,
      token: null,
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(await classifiedFailure(blocked.connect())).toEqual({ kind: "cors" });
  });
});

describe("classifyMcpError", () => {
  it("maps SDK error types and HTTP statuses, never messages", () => {
    expect(classifyMcpError(new UnauthorizedError())).toEqual({ kind: "auth" });
    expect(classifyMcpError(new StreamableHTTPError(403, "x"))).toEqual({
      kind: "auth",
      status: 403,
    });
    expect(classifyMcpError(new StreamableHTTPError(404, "x"))).toMatchObject({
      kind: "notFound",
    });
    expect(classifyMcpError(new StreamableHTTPError(-1, "x"))).toEqual({ kind: "protocol" });
    expect(classifyMcpError(new StreamableHTTPError(502, "x"))).toMatchObject({
      kind: "network",
    });
    expect(classifyMcpError(new McpError(ErrorCode.RequestTimeout, "x"))).toEqual({
      kind: "network",
    });
    expect(classifyMcpError(new McpError(ErrorCode.MethodNotFound, "x"))).toEqual({
      kind: "protocol",
    });
    expect(classifyMcpError(new TypeError("Failed to fetch"), true)).toEqual({ kind: "cors" });
    expect(classifyMcpError(new TypeError("Failed to fetch"), false)).toEqual({
      kind: "network",
    });
  });
});
