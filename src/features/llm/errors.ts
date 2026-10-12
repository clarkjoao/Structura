import type { LLMMode, LLMProvider } from "./types";

/**
 * Why a chat request failed, classified from the transport outcome alone: the
 * HTTP status (or its absence), the connection mode and whether our own
 * timeout fired. Never from the error message text — a browser reports a
 * refused connection, a CORS block and a mixed-content block with the same
 * opaque `TypeError`, so the message carries no reliable signal.
 */
export type LLMErrorKind =
  | "auth"
  | "rate_limit"
  | "networkOrCors"
  | "proxyUnreachable"
  | "proxyRejected"
  | "proxyEndpointNotFound"
  | "modelNotFound"
  | "server"
  | "timeout"
  | "unknown";

export interface LLMErrorContext {
  mode: LLMMode;
  provider: LLMProvider;
}

/** The failure as the store keeps it: classified, with the raw cause attached. */
export interface LLMError extends LLMErrorContext {
  kind: LLMErrorKind;
  status: number | null;
  detail: string;
}

interface LLMProviderErrorInit extends LLMErrorContext {
  /** HTTP status, or null when no response arrived (the fetch itself rejected). */
  status: number | null;
  detail: string;
  /** True when the request was aborted by `createRequestTimeout`. */
  timedOut?: boolean;
}

/**
 * How long a request may go without receiving anything — the response headers
 * or the next stream chunk — before it is aborted. It is an inactivity window,
 * not a cap on the whole response: a long generation that keeps streaming is
 * never cut, a provider or proxy that stops answering is.
 */
export const LLM_REQUEST_TIMEOUT_MS = 60_000;

export class LLMProviderError extends Error {
  readonly status: number | null;
  readonly mode: LLMMode;
  readonly provider: LLMProvider;
  readonly detail: string;
  readonly timedOut: boolean;

  constructor(init: LLMProviderErrorInit) {
    super(init.detail);
    this.name = "LLMProviderError";
    this.status = init.status;
    this.mode = init.mode;
    this.provider = init.provider;
    this.detail = init.detail;
    this.timedOut = init.timedOut ?? false;
  }

  get kind(): LLMErrorKind {
    return classifyLLMError(this);
  }

  toLLMError(): LLMError {
    return {
      kind: this.kind,
      status: this.status,
      mode: this.mode,
      provider: this.provider,
      detail: this.detail,
    };
  }
}

export function classifyLLMError(outcome: {
  status: number | null;
  mode: LLMMode;
  timedOut?: boolean;
}): LLMErrorKind {
  const { status, mode, timedOut } = outcome;
  const viaProxy = mode === "proxy";
  if (timedOut) {
    return "timeout";
  }
  if (status === null) {
    return viaProxy ? "proxyUnreachable" : "networkOrCors";
  }
  if (status === 401 || status === 403) {
    return viaProxy ? "proxyRejected" : "auth";
  }
  if (status === 404) {
    return viaProxy ? "proxyEndpointNotFound" : "modelNotFound";
  }
  if (status === 429) {
    return "rate_limit";
  }
  if (status >= 500) {
    return "server";
  }
  return "unknown";
}

/** Normalises anything a request can throw into the stored error shape. */
export function toLLMError(error: unknown, context: LLMErrorContext): LLMError {
  if (error instanceof LLMProviderError) {
    return error.toLLMError();
  }
  return {
    kind: "unknown",
    status: null,
    ...context,
    detail: error instanceof Error ? error.message : String(error),
  };
}

export function getLLMErrorI18nKey(error: LLMError): string {
  // A custom endpoint is the one direct target whose CORS policy the user
  // controls, so it gets the message that says what to change on the server.
  if (error.kind === "networkOrCors" && error.provider === "custom") {
    return "llmChat.error.corsCustom";
  }
  return `llmChat.error.${error.kind}`;
}

/** Errors the user fixes in LLM settings, so the panel offers a shortcut there. */
export function isSettingsFixableError(error: LLMError): boolean {
  return (
    error.kind === "auth" ||
    error.kind === "modelNotFound" ||
    error.kind === "networkOrCors" ||
    error.kind === "proxyUnreachable" ||
    error.kind === "proxyEndpointNotFound"
  );
}

export interface RequestTimeout {
  signal: AbortSignal;
  /** Restarts the inactivity window; call it whenever data arrives. */
  touch: () => void;
  clear: () => void;
  readonly timedOut: boolean;
}

export function createRequestTimeout(ms: number = LLM_REQUEST_TIMEOUT_MS): RequestTimeout {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
  };
  arm();
  return {
    signal: controller.signal,
    touch: arm,
    clear: () => clearTimeout(timer),
    get timedOut() {
      return timedOut;
    },
  };
}

/**
 * `fetch` under an inactivity timeout. A rejected fetch and a non-ok response
 * both become an `LLMProviderError` carrying the status (null when no response
 * arrived) and the raw cause.
 */
export async function fetchLLM(
  url: string,
  init: RequestInit,
  context: LLMErrorContext,
  timeout: RequestTimeout,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: timeout.signal });
  } catch (error) {
    throw new LLMProviderError({
      ...context,
      status: null,
      detail: error instanceof Error ? error.message : String(error),
      timedOut: timeout.timedOut,
    });
  }
  timeout.touch();
  if (!response.ok) {
    throw new LLMProviderError({
      ...context,
      status: response.status,
      detail: await response.text(),
    });
  }
  return response;
}

/** One stream read under the same inactivity timeout as the request. */
export async function readLLMChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  context: LLMErrorContext,
  timeout: RequestTimeout,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  try {
    const result = await reader.read();
    timeout.touch();
    return result;
  } catch (error) {
    throw new LLMProviderError({
      ...context,
      status: null,
      detail: error instanceof Error ? error.message : String(error),
      timedOut: timeout.timedOut,
    });
  }
}
