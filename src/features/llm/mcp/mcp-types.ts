/** Types shared by the eager MCP store and the lazily loaded MCP runtime. */

/** Why a server is unusable, classified by HTTP status and error type. */
export type McpErrorKind =
  | "cors"
  | "auth"
  | "notFound"
  | "protocol"
  | "network"
  /** The server had a session-only token, and the session is gone. */
  | "tokenMissing";

export interface McpConnectionError {
  kind: McpErrorKind;
  /** The HTTP status, when there was one. */
  status?: number;
}

export type McpServerStatus =
  | { state: "disconnected" }
  | { state: "connecting" }
  | { state: "connected"; latencyMs: number }
  | { state: "error"; error: McpConnectionError };

export function isConnectedStatus(
  status: McpServerStatus | undefined,
): status is Extract<McpServerStatus, { state: "connected" }> {
  return status?.state === "connected";
}

export function isConnectingStatus(
  status: McpServerStatus | undefined,
): status is Extract<McpServerStatus, { state: "connecting" }> {
  return status?.state === "connecting";
}

export function isErrorStatus(
  status: McpServerStatus | undefined,
): status is Extract<McpServerStatus, { state: "error" }> {
  return status?.state === "error";
}

/** Auth problems the user fixes with a token: shown amber, with "Enter token". */
export function isTokenProblem(error: McpConnectionError): boolean {
  return error.kind === "auth" || error.kind === "tokenMissing";
}

/** Server-declared hints. Shown in settings; they never change behavior. */
export interface McpToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  openWorldHint?: boolean;
}

/** A tool as the server lists it. Name and description are server data. */
export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema: unknown;
  annotations: McpToolAnnotations;
}

/** A `tools/call` result, narrowed to what the chat reads. */
export interface McpCallResult {
  content: unknown[];
  structuredContent?: unknown;
  isError?: boolean;
}

/** A listed tool as settings shows it. */
export interface McpToolEntry {
  /** The server's own name. */
  name: string;
  /** `mcp__<serverId>__<name>`, sanitized and shortened for providers. */
  registryName: string;
  description: string;
  annotations: McpToolAnnotations;
  /** False when its input schema could not be converted; never offered. */
  supported: boolean;
}

export const MCP_ERROR_KEYS: Record<McpErrorKind, string> = {
  cors: "llmChat.mcp.error.cors",
  auth: "llmChat.mcp.error.auth",
  notFound: "llmChat.mcp.error.notFound",
  protocol: "llmChat.mcp.error.protocol",
  network: "llmChat.mcp.error.network",
  tokenMissing: "llmChat.mcp.error.tokenMissing",
};
