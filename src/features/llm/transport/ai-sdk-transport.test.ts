import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROXY_BASE_URL } from "../llm-storage";
import { replyWith } from "../test-utils/openai-sse";
import type { LLMConfig } from "../types";
import { createRequestTimeout, LLMProviderError, toLLMError } from "../errors";
import { streamChat, toTransportError } from "./ai-sdk-transport";

function captureRequest(response: () => Response = () => replyWith("ok")) {
  const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => response());
  vi.stubGlobal("fetch", fetchSpy);
  return {
    async send(config: LLMConfig) {
      await streamChat({
        config,
        messages: [{ role: "user", content: "hi" }],
        systemPrompt: "system prompt",
        onChunk: () => {},
      }).catch(() => undefined);
      const [url, init] = fetchSpy.mock.calls[0] ?? [];
      return {
        url,
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      };
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI SDK transport — provider mapping", () => {
  it("proxy: posts an OpenAI-compatible request to the connection's base URL", async () => {
    const { url, headers, body } = await captureRequest().send({
      mode: "proxy",
      provider: "openai",
      apiKey: "",
      model: "team-model",
      baseUrl: "https://llm.team.example/v1/",
    });
    expect(url).toBe("https://llm.team.example/v1/chat/completions");
    expect(headers.get("authorization")).toBeNull();
    expect(body.model).toBe("team-model");
    expect(body.stream).toBe(true);
    // The old {provider, model, messages, systemPrompt} contract is gone.
    expect(body).not.toHaveProperty("systemPrompt");
    expect(body).not.toHaveProperty("provider");
    expect(body.messages).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "hi" },
    ]);
  });

  it("proxy without a base URL falls back to the default", async () => {
    const { url } = await captureRequest().send({
      mode: "proxy",
      provider: "openai",
      apiKey: "",
      model: "m",
    });
    expect(url).toBe(`${DEFAULT_PROXY_BASE_URL}/chat/completions`);
  });

  it("direct OpenAI: chat completions with a bearer key and the output ceiling", async () => {
    const { url, headers, body } = await captureRequest().send({
      mode: "direct",
      provider: "openai",
      apiKey: "sk-openai",
      model: "gpt-4o-mini",
    });
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(headers.get("authorization")).toBe("Bearer sk-openai");
    expect(body.max_tokens ?? body.max_completion_tokens).toBe(16000);
  });

  it("direct Anthropic: messages API with the key and the browser-access header", async () => {
    const { url, headers } = await captureRequest(() => new Response("", { status: 200 })).send({
      mode: "direct",
      provider: "anthropic",
      apiKey: "sk-ant",
      model: "claude-sonnet-5-5",
    });
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers.get("x-api-key")).toBe("sk-ant");
    expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
  });

  it("custom: does not double a stored completions URL and uses the custom auth header", async () => {
    const { url, headers, body } = await captureRequest().send({
      mode: "direct",
      provider: "custom",
      apiKey: "tok",
      model: "local",
      baseUrl: "http://localhost:11434/v1/chat/completions",
      authHeader: "X-Api-Key",
      extraHeaders: { "X-Org": "acme" },
      extraParams: { temperature: 0.1 },
    });
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(headers.get("x-api-key")).toBe("tok");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("x-org")).toBe("acme");
    expect(body.temperature).toBe(0.1);
  });

  it("streams the text and reports a clean stop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => replyWith("Hello")),
    );
    const chunks: string[] = [];
    const completion = await streamChat({
      config: { mode: "proxy", provider: "openai", apiKey: "", model: "m" },
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "s",
      onChunk: (chunk) => chunks.push(chunk),
    });
    expect(chunks.join("")).toBe("Hello");
    expect(completion).toEqual({ text: "Hello", stopReason: "stop" });
  });

  it("custom-anthropic: posts to the messages API with x-api-key and the browser-access header", async () => {
    const { url, headers } = await captureRequest(() => new Response("", { status: 200 })).send({
      mode: "direct",
      provider: "custom",
      customProtocol: "anthropic",
      apiKey: "sk-proxy",
      model: "claude-sonnet-5-5",
      baseUrl: "https://anthropic-proxy.example.com/v1/messages",
    });
    expect(url).toBe("https://anthropic-proxy.example.com/v1/messages");
    expect(headers.get("x-api-key")).toBe("sk-proxy");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
  });

  it("custom-anthropic: trims a trailing slash on the base URL", async () => {
    const { url } = await captureRequest(() => new Response("", { status: 200 })).send({
      mode: "direct",
      provider: "custom",
      customProtocol: "anthropic",
      apiKey: "sk-proxy",
      model: "claude-haiku-5-5",
      baseUrl: "https://anthropic-proxy.example.com/v1/",
    });
    expect(url).toBe("https://anthropic-proxy.example.com/v1/messages");
  });

  it("custom-anthropic: uses the custom auth header when one is set", async () => {
    const { headers } = await captureRequest(() => new Response("", { status: 200 })).send({
      mode: "direct",
      provider: "custom",
      customProtocol: "anthropic",
      apiKey: "tok",
      authHeader: "X-Custom-Key",
      model: "claude-sonnet-5-5",
      baseUrl: "https://anthropic-proxy.example.com",
    });
    expect(headers.get("x-custom-key")).toBe("tok");
    expect(headers.get("x-api-key")).toBeNull();
    expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
  });

  it("custom: default protocol is OpenAI-compatible (regression)", async () => {
    const { url } = await captureRequest().send({
      mode: "direct",
      provider: "custom",
      apiKey: "tok",
      model: "local",
      baseUrl: "http://localhost:11434/v1/chat/completions",
    });
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
  });
});

describe("AI SDK transport — error mapping", () => {
  const context = { mode: "direct", provider: "openai" } as const;

  it("maps an APICallError to its status code and response body", async () => {
    const { APICallError } = await import("ai");
    const error = await toTransportError(
      new APICallError({
        message: "Unauthorized",
        url: "https://api.openai.com/v1/chat/completions",
        requestBodyValues: {},
        statusCode: 401,
        responseBody: '{"error":"bad key"}',
      }),
      context,
      createRequestTimeout(),
    );
    expect(error).toBeInstanceOf(LLMProviderError);
    expect(toLLMError(error, context)).toMatchObject({
      kind: "auth",
      status: 401,
      detail: '{"error":"bad key"}',
    });
  });

  it("treats any fetch rejection without a response as unreachable, whatever its message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        // Safari's wording, with no cause attached.
        throw new TypeError("Load failed");
      }),
    );
    const error = await streamChat({
      config: { mode: "proxy", provider: "openai", apiKey: "", model: "m" },
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "s",
      onChunk: () => {},
    }).catch((caught: unknown) => caught);
    expect(toLLMError(error, { mode: "proxy", provider: "openai" }).kind).toBe("proxyUnreachable");
  });

  it("reports a reply cut at the token limit as a length stop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => replyWith("Partial answer", "length")),
    );
    const completion = await streamChat({
      config: { mode: "proxy", provider: "openai", apiKey: "", model: "m" },
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "s",
      onChunk: () => {},
    });
    expect(completion).toEqual({ text: "Partial answer", stopReason: "length" });
  });
});
