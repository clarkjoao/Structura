import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "./custom";
import { LLMProviderError } from "../errors";
import type { LLMConfig } from "../types";

type FetchCall = Parameters<typeof fetch>;
type FetchInit = FetchCall[1];

function sseResponse(body: string, init: { ok?: boolean; status?: number } = {}): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": "text/event-stream" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseConfig: LLMConfig = {
  mode: "direct",
  provider: "custom",
  apiKey: "tok",
  model: "my-model",
  baseUrl: "https://proxy.example.com/v1/chat/completions",
};

describe("custom provider", () => {
  it("uses Bearer Authorization by default", async () => {
    const fetchSpy = vi.fn(async () =>
      sseResponse('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n'),
    );
    vi.stubGlobal("fetch", fetchSpy);

    let acc = "";
    await sendMessage(baseConfig, [], "system prompt", (chunk) => {
      acc += chunk;
    });
    expect(acc).toBe("hi");
    const call = fetchSpy.mock.calls[0] as unknown as FetchCall | undefined;
    const init = call?.[1] as FetchInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["Authorization"]).toBe("Bearer tok");
  });

  it("emits a non-Authorization auth header without a Bearer prefix when overridden", async () => {
    const fetchSpy = vi.fn(async () =>
      sseResponse('data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: [DONE]\n'),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await sendMessage({ ...baseConfig, authHeader: "x-api-key" }, [], "system prompt", () => {});
    const call = fetchSpy.mock.calls[0] as unknown as FetchCall | undefined;
    const init = call?.[1] as FetchInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["x-api-key"]).toBe("tok");
    expect(headers?.["Authorization"]).toBeUndefined();
  });

  it("merges extraHeaders and extraParams into the request", async () => {
    const fetchSpy = vi.fn(async () =>
      sseResponse('data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: [DONE]\n'),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await sendMessage(
      {
        ...baseConfig,
        extraHeaders: { "X-Org": "acme" },
        extraParams: { temperature: 0.1, top_p: 0.95 },
      },
      [
        { id: "u", role: "user", content: "Hello", timestamp: 1 },
        { id: "a", role: "assistant", content: "previous", timestamp: 2 },
      ],
      "system prompt",
      () => {},
    );
    const call = fetchSpy.mock.calls[0] as unknown as FetchCall | undefined;
    const init = call?.[1] as FetchInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["X-Org"]).toBe("acme");
    expect(headers?.["Authorization"]).toBe("Bearer tok");
    expect(init?.body).toBe(
      JSON.stringify({
        model: "my-model",
        stream: true,
        messages: [
          { role: "system", content: "system prompt" },
          { role: "user", content: "Hello" },
          { role: "assistant", content: "previous" },
        ],
        temperature: 0.1,
        top_p: 0.95,
      }),
    );
  });

  it("throws LLMProviderError with provider=custom when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 502 })),
    );
    await expect(sendMessage(baseConfig, [], "system prompt", () => {})).rejects.toBeInstanceOf(
      LLMProviderError,
    );
  });

  it("sends a clean error when baseUrl is missing", async () => {
    await expect(
      sendMessage({ ...baseConfig, baseUrl: undefined }, [], "system prompt", () => {}),
    ).rejects.toThrow(/baseUrl/);
  });
});
