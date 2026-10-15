import type { LanguageModel, ToolSet } from "ai";
import {
  LLMProviderError,
  LLMRequestCancelledError,
  createRequestTimeout,
  type LLMErrorContext,
  type RequestTimeout,
} from "../errors";
import { DEFAULT_PROXY_BASE_URL, toOpenAICompatibleBaseUrl } from "../llm-storage";
import type { LLMCompletion, LLMConfig, LLMRequestMessage, LLMStopReason } from "../types";

/**
 * Output ceiling for one response on the direct OpenAI and Anthropic models.
 * 16000 fits the smallest supported preset of each provider (see the presets);
 * custom and proxy endpoints use their own default.
 */
export const MAX_OUTPUT_TOKENS = 16000;

const ANTHROPIC_BROWSER_HEADER = { "anthropic-dangerous-direct-browser-access": "true" };

/**
 * The browser rejected the request before any response arrived: connection
 * refused, DNS failure, CORS or mixed content — the browser does not say
 * which. Raised by our fetch wrapper so the cause is a type, not a message.
 */
export class FetchRejectedError extends Error {
  readonly original: unknown;

  constructor(original: unknown) {
    super(original instanceof Error ? original.message : String(original));
    this.name = "FetchRejectedError";
    this.original = original;
  }
}

/**
 * Wraps `fetch` so a rejection without a response surfaces as
 * `FetchRejectedError`, while an abort stays an abort. Looked up at call time
 * so tests can stub `globalThis.fetch`.
 */
function trackedFetch(): typeof fetch {
  return async (input, init) => {
    try {
      return await globalThis.fetch(input, init);
    } catch (error) {
      if (init?.signal?.aborted) {
        throw error;
      }
      throw new FetchRejectedError(error);
    }
  };
}

function errorContext(config: LLMConfig): LLMErrorContext {
  return { mode: config.mode, provider: config.provider };
}

/**
 * Builds the SDK model for a connection. The SDK is imported here, on first
 * use, so it lands in the chat's lazy chunk and never in the main bundle.
 */
export async function createLanguageModel(config: LLMConfig): Promise<LanguageModel> {
  const fetch = trackedFetch();

  if (config.mode === "proxy") {
    // The proxy is any OpenAI-compatible endpoint; it holds the provider keys.
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return createOpenAICompatible({
      name: "proxy",
      baseURL: toOpenAICompatibleBaseUrl(config.baseUrl || DEFAULT_PROXY_BASE_URL),
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      fetch,
    }).chatModel(config.model);
  }

  switch (config.provider) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({
        apiKey: config.apiKey,
        // Without it the API refuses the CORS preflight from a browser origin.
        headers: ANTHROPIC_BROWSER_HEADER,
        fetch,
      })(config.model);
    }
    case "custom": {
      if (config.customProtocol === "anthropic") {
        const { createAnthropic } = await import("@ai-sdk/anthropic");
        const authHeader = config.authHeader?.trim();
        const useXApiKey = !authHeader || authHeader.toLowerCase() === "x-api-key";
        const headers: Record<string, string> = {
          // The browser needs this for the CORS preflight; the official
          // Anthropic client adds it on every request.
          ...ANTHROPIC_BROWSER_HEADER,
          ...(!useXApiKey && authHeader && config.apiKey ? { [authHeader]: config.apiKey } : {}),
          ...(config.extraHeaders ?? {}),
        };
        // The SDK always sends `x-api-key` and throws when no key is set, so it
        // gets an empty one here and the fetch drops it on the way out.
        return createAnthropic({
          baseURL: toAnthropicBaseUrl(config.baseUrl ?? ""),
          apiKey: useXApiKey ? config.apiKey : "",
          headers,
          fetch: withoutEmptyHeader(fetch, "x-api-key"),
        })(config.model);
      }
      const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
      const authHeader = config.authHeader?.trim();
      const usesBearer = !authHeader || authHeader.toLowerCase() === "authorization";
      const extraParams = config.extraParams;
      return createOpenAICompatible({
        name: "custom",
        baseURL: toOpenAICompatibleBaseUrl(config.baseUrl ?? ""),
        ...(usesBearer && config.apiKey ? { apiKey: config.apiKey } : {}),
        headers: {
          ...(!usesBearer && authHeader && config.apiKey ? { [authHeader]: config.apiKey } : {}),
          ...(config.extraHeaders ?? {}),
        },
        ...(extraParams ? { transformRequestBody: (body) => ({ ...body, ...extraParams }) } : {}),
        fetch,
      }).chatModel(config.model);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey: config.apiKey, fetch }).chat(config.model);
    }
  }
}

/** Wraps `fetch` so a request never carries `name` with an empty value. */
function withoutEmptyHeader(fetch: typeof globalThis.fetch, name: string): typeof globalThis.fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get(name) !== "") return fetch(input, init);
    headers.delete(name);
    return fetch(input, { ...init, headers });
  };
}

/** Strips a trailing "/messages" so the Anthropic SDK can append its own path. */
function toAnthropicBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/messages$/, "");
}

function toStopReason(finishReason: string): LLMStopReason {
  if (finishReason === "length") return "length";
  if (finishReason === "stop" || finishReason === "tool-calls") return "stop";
  return "unknown";
}

function causeOf(error: Error): unknown {
  return "cause" in error ? error.cause : undefined;
}

/** True when our fetch wrapper raised it, directly or as the SDK's cause. */
function hasFetchRejection(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    if (current instanceof FetchRejectedError) return true;
    current = causeOf(current);
  }
  return false;
}

/**
 * Maps whatever the SDK raised onto the chat's error model. Which controller
 * aborted decides between a user cancel and a timeout; an HTTP failure keeps
 * its status and body; a request that never got a response has no status.
 */
export async function toTransportError(
  error: unknown,
  context: LLMErrorContext,
  timeout: RequestTimeout,
): Promise<Error> {
  if (timeout.cancelled) {
    return new LLMRequestCancelledError();
  }
  const detail = error instanceof Error ? error.message : String(error);
  if (timeout.timedOut) {
    return new LLMProviderError({ ...context, status: null, detail, timedOut: true });
  }
  if (error instanceof LLMProviderError || error instanceof LLMRequestCancelledError) {
    return error;
  }
  if (hasFetchRejection(error)) {
    return new LLMProviderError({ ...context, status: null, detail });
  }
  const { APICallError } = await import("ai");
  if (APICallError.isInstance(error)) {
    return new LLMProviderError({
      ...context,
      status: error.statusCode ?? null,
      detail: error.responseBody ?? error.message,
    });
  }
  return error instanceof Error ? error : new Error(detail);
}

/**
 * Sends the smallest request the connection can answer (one output token) and
 * maps a failure the way a chat turn does. For connections with no models
 * endpoint to ask, so a connection test still makes a round trip.
 */
export async function pingModel(config: LLMConfig): Promise<void> {
  const context = errorContext(config);
  const timeout = createRequestTimeout();
  try {
    const [{ generateText }, model] = await Promise.all([
      import("ai"),
      createLanguageModel(config),
    ]);
    await generateText({
      model,
      prompt: "ping",
      maxOutputTokens: 1,
      maxRetries: 0,
      abortSignal: timeout.signal,
    });
  } catch (error) {
    throw await toTransportError(error, context, timeout);
  } finally {
    timeout.clear();
  }
}

export interface ChatStreamRequest {
  config: LLMConfig;
  messages: LLMRequestMessage[];
  systemPrompt: string;
  onChunk: (chunk: string) => void;
  /** The user's Stop. Merged with the inactivity timeout. */
  signal?: AbortSignal;
  /** Tools the model may call; the SDK runs them in a loop of up to MAX_TOOL_STEPS steps. */
  tools?: ToolSet;
  /** Tool activity, in stream order, so the chat can show each call as it happens. */
  onToolEvent?: (event: ToolEvent) => void;
}

/** A tool call starting, finishing with an output, or failing. */
export type ToolEvent =
  | { kind: "call"; id: string; name: string; input: unknown }
  | { kind: "result"; id: string; output: unknown }
  | { kind: "error"; id: string; error: string };

/** Most model calls one reply may make: each tool round trip is one step. */
export const MAX_TOOL_STEPS = 8;

/** Streams one reply through the AI SDK. */
export async function streamChat(request: ChatStreamRequest): Promise<LLMCompletion> {
  const { config } = request;
  const context = errorContext(config);
  const timeout = createRequestTimeout(undefined, request.signal);
  try {
    const [{ streamText, isStepCount }, model] = await Promise.all([
      import("ai"),
      createLanguageModel(config),
    ]);
    const usesDirectCeiling =
      config.mode === "direct" && (config.provider === "openai" || config.provider === "anthropic");
    const result = streamText({
      model,
      system: request.systemPrompt,
      messages: request.messages,
      abortSignal: timeout.signal,
      maxRetries: 0,
      ...(request.tools ? { tools: request.tools, stopWhen: isStepCount(MAX_TOOL_STEPS) } : {}),
      ...(usesDirectCeiling ? { maxOutputTokens: MAX_OUTPUT_TOKENS } : {}),
    });

    let text = "";
    let stopReason: LLMStopReason = "unknown";
    for await (const part of result.fullStream) {
      timeout.touch();
      switch (part.type) {
        case "text-delta":
          text += part.text;
          request.onChunk(part.text);
          break;
        case "tool-call":
          request.onToolEvent?.({
            kind: "call",
            id: part.toolCallId,
            name: part.toolName,
            input: part.input,
          });
          break;
        case "tool-result":
          request.onToolEvent?.({ kind: "result", id: part.toolCallId, output: part.output });
          break;
        case "tool-error":
          request.onToolEvent?.({
            kind: "error",
            id: part.toolCallId,
            error: part.error instanceof Error ? part.error.message : String(part.error),
          });
          break;
        case "finish":
          stopReason = toStopReason(part.finishReason);
          break;
        case "error":
          throw part.error;
        case "abort":
          throw new DOMException("The operation was aborted.", "AbortError");
        default:
          break;
      }
    }
    if (timeout.cancelled || timeout.timedOut) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return { text, stopReason };
  } catch (error) {
    throw await toTransportError(error, context, timeout);
  } finally {
    timeout.clear();
  }
}
