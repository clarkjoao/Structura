import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readOpenAICompatibleStreamForTest,
  sendOpenAICompatibleMessage,
} from "./openai-compatible";
import { LLMProviderError } from "../errors";

type FetchCall = Parameters<typeof fetch>;
type FetchInit = FetchCall[1];

function sseResponse(body: string, init: { ok?: boolean; status?: number } = {}): Response {
  const headers = new Headers({ "content-type": "text/event-stream" });
  return new Response(body, {
    status: init.status ?? 200,
    statusText: init.status ? "ERROR" : "OK",
    headers,
  });
}

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendOpenAICompatibleMessage", () => {
  it("POSTs the body to baseUrl with merged headers", async () => {
    const fetchSpy = vi.fn(async () =>
      sseResponse('data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n'),
    );
    vi.stubGlobal("fetch", fetchSpy);

    let streamed = "";
    const result = await sendOpenAICompatibleMessage(
      {
        baseUrl: "https://proxy.example.com/v1/chat/completions",
        headers: { Authorization: "Bearer tok" },
        body: { model: "foo", stream: true },
        errorOrigin: "custom",
      },
      (chunk) => {
        streamed += chunk;
      },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://proxy.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer tok",
        }),
        body: JSON.stringify({ model: "foo", stream: true }),
      }),
    );
    expect(result).toBe("hello");
    expect(streamed).toBe("hello");
  });

  it("throws LLMProviderError with errorOrigin=custom when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(
      sendOpenAICompatibleMessage(
        {
          baseUrl: "https://proxy.example.com/v1/chat/completions",
          headers: {},
          body: {},
          errorOrigin: "custom",
        },
        () => {},
      ),
    ).rejects.toMatchObject({
      name: "LLMProviderError",
      provider: "custom",
      status: null,
    });
  });

  it("throws LLMProviderError with status on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "bad token" }, { status: 401 })),
    );

    await expect(
      sendOpenAICompatibleMessage(
        {
          baseUrl: "https://api.example.com/v1",
          headers: {},
          body: {},
          errorOrigin: "openai",
        },
        () => {},
      ),
    ).rejects.toBeInstanceOf(LLMProviderError);
  });

  it("merges extra headers and extra body params into the request", async () => {
    const fetchSpy = vi.fn(async () => sseResponse(""));
    vi.stubGlobal("fetch", fetchSpy);

    await sendOpenAICompatibleMessage(
      {
        baseUrl: "https://proxy.example.com/v1/chat/completions",
        headers: { "x-api-key": "plain-token", "X-Org": "acme" },
        body: { model: "foo", temperature: 0.2, top_p: 0.95 },
        errorOrigin: "custom",
      },
      () => {},
    );

    const call = fetchSpy.mock.calls[0] as unknown as FetchCall | undefined;
    expect(call?.[0]).toBe("https://proxy.example.com/v1/chat/completions");
    const init = call?.[1] as FetchInit | undefined;
    expect(init?.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "x-api-key": "plain-token",
        "X-Org": "acme",
      }),
    );
    expect(init?.body).toBe(JSON.stringify({ model: "foo", temperature: 0.2, top_p: 0.95 }));
  });

  it("returns the empty string when the response has no body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const result = await sendOpenAICompatibleMessage(
      {
        baseUrl: "https://api.example.com/v1",
        headers: {},
        body: {},
        errorOrigin: "openai",
      },
      () => {},
    );
    expect(result).toBe("");
  });
});

describe("readOpenAICompatibleStream", () => {
  it("decodes multi-chunk SSE output", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"Hello, "}}]}\n\n' +
              'data: {"choices":[{"delta":{"content":"world!"}}]}\n\n' +
              "data: [DONE]\n",
          ),
        );
        controller.close();
      },
    });

    let accumulated = "";
    const full = await readOpenAICompatibleStreamForTest(body, (chunk: string) => {
      accumulated += chunk;
    });
    expect(full).toBe("Hello, world!");
    expect(accumulated).toBe("Hello, world!");
  });

  it("ignores malformed lines silently", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode('data: {not-json}\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\n'),
        );
        controller.close();
      },
    });

    const full = await readOpenAICompatibleStreamForTest(body, (_chunk: string) => {});
    expect(full).toBe("ok");
  });
});
