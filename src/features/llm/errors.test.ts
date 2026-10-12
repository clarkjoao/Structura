import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LLM_REQUEST_TIMEOUT_MS,
  LLMProviderError,
  LLMRequestCancelledError,
  getLLMErrorI18nKey,
  toLLMError,
  type LLMErrorKind,
} from "./errors";
import { sendMessage as sendProxyMessage } from "./providers/proxy";
import { sendMessage as sendOpenAIMessage } from "./providers/openai";
import { sendMessage as sendAnthropicMessage } from "./providers/anthropic";
import type { LLMConfig, LLMMode } from "./types";

type Outcome = "fetchRejection" | 401 | 404 | 429 | 500 | "timeout";

const EXPECTED: Record<LLMMode, Record<string, LLMErrorKind>> = {
  proxy: {
    fetchRejection: "proxyUnreachable",
    401: "proxyRejected",
    404: "proxyEndpointNotFound",
    429: "rate_limit",
    500: "server",
    timeout: "timeout",
  },
  direct: {
    fetchRejection: "networkOrCors",
    401: "auth",
    404: "modelNotFound",
    429: "rate_limit",
    500: "server",
    timeout: "timeout",
  },
};

function stubFetch(outcome: Outcome): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) => {
      if (outcome === "fetchRejection") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      if (outcome === "timeout") {
        // Never answers; only our abort ends it.
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        });
      }
      return Promise.resolve(new Response("upstream says no", { status: outcome }));
    }),
  );
}

const configFor = (mode: LLMMode): LLMConfig => ({
  mode,
  provider: "openai",
  apiKey: "sk-test",
  model: "gpt-4o-mini",
});

async function captureError(mode: LLMMode, outcome: Outcome): Promise<unknown> {
  stubFetch(outcome);
  const send = mode === "proxy" ? sendProxyMessage : sendOpenAIMessage;
  const pending = send(configFor(mode), [], "system", () => {}).then(
    () => null,
    (error: unknown) => error,
  );
  if (outcome === "timeout") {
    await vi.advanceTimersByTimeAsync(LLM_REQUEST_TIMEOUT_MS);
  }
  return pending;
}

describe("LLM error classification", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const outcomes: Outcome[] = ["fetchRejection", 401, 404, 429, 500, "timeout"];
  for (const mode of ["proxy", "direct"] as const) {
    for (const outcome of outcomes) {
      it(`${mode} × ${outcome} → ${EXPECTED[mode][String(outcome)]}`, async () => {
        vi.useFakeTimers();
        const error = await captureError(mode, outcome);
        expect(error).toBeInstanceOf(LLMProviderError);
        const llmError = toLLMError(error, { mode, provider: "openai" });
        expect(llmError.kind).toBe(EXPECTED[mode][String(outcome)]);
        expect(llmError.mode).toBe(mode);
      });
    }
  }

  it("keeps the status and raw response body", async () => {
    const error = await captureError("proxy", 401);
    expect(toLLMError(error, { mode: "proxy", provider: "openai" })).toMatchObject({
      status: 401,
      detail: "upstream says no",
    });
  });

  it("classifies a non-provider throw as unknown with its message as detail", () => {
    expect(toLLMError(new Error("boom"), { mode: "direct", provider: "custom" })).toEqual({
      kind: "unknown",
      status: null,
      mode: "direct",
      provider: "custom",
      detail: "boom",
    });
  });

  it("points an unreachable custom endpoint at its CORS policy", () => {
    const error = new LLMProviderError({
      mode: "direct",
      provider: "custom",
      status: null,
      detail: "Failed to fetch",
    });
    expect(getLLMErrorI18nKey(error.toLLMError())).toBe("llmChat.error.corsCustom");
  });
});

describe("Anthropic provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the browser-access header", async () => {
    const fetchSpy = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    await sendAnthropicMessage(
      { mode: "direct", provider: "anthropic", apiKey: "sk-ant", model: "claude-sonnet-5-5" },
      [],
      "system",
      () => {},
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        headers: expect.objectContaining({
          "anthropic-dangerous-direct-browser-access": "true",
        }),
      }),
    );
  });
});

describe("cancel vs timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a caller abort is a cancel, not an error kind", async () => {
    stubFetch("timeout");
    const controller = new AbortController();
    const pending = sendOpenAIMessage(
      configFor("direct"),
      [],
      "system",
      () => {},
      controller.signal,
    )
      .then(() => null)
      .catch((error: unknown) => error);
    controller.abort();
    const error = await pending;
    expect(error).toBeInstanceOf(LLMRequestCancelledError);
    expect(error).not.toBeInstanceOf(LLMProviderError);
  });

  it("the inactivity timeout still classifies as timeout when a caller signal is passed", async () => {
    vi.useFakeTimers();
    stubFetch("timeout");
    const controller = new AbortController();
    const pending = sendProxyMessage(configFor("proxy"), [], "system", () => {}, controller.signal)
      .then(() => null)
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(LLM_REQUEST_TIMEOUT_MS);
    const error = await pending;
    expect(toLLMError(error, { mode: "proxy", provider: "openai" }).kind).toBe("timeout");
  });
});
