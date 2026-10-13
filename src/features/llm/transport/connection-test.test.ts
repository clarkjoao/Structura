import { afterEach, describe, expect, it, vi } from "vitest";
import { modelsForConnection } from "../model-presets";
import { parseModelList, testConnection } from "./connection-test";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("testConnection", () => {
  it("lists a proxy's models from GET <base>/models, sorted, with latency", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ data: [{ id: "team-large" }, { id: "team-small" }, { nope: 1 }] }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const result = await testConnection({
      mode: "proxy",
      provider: "openai",
      apiKey: "proxy-token",
      model: "team-small",
      baseUrl: "https://llm.team.example/v1/chat/completions",
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://llm.team.example/v1/models");
    expect(new Headers(fetchSpy.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer proxy-token",
    );
    expect(result).toMatchObject({
      ok: true,
      models: ["team-large", "team-small"],
      source: "endpoint",
    });
    expect(result.ok && typeof result.latencyMs).toBe("number");
  });

  it("returns the structured error: 401 from a proxy, no response from a custom endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 401 })),
    );
    const rejected = await testConnection({
      mode: "proxy",
      provider: "openai",
      apiKey: "",
      model: "m",
      baseUrl: "http://localhost:3001",
    });
    expect(rejected).toMatchObject({ ok: false, error: { kind: "proxyRejected", status: 401 } });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const unreachable = await testConnection({
      mode: "direct",
      provider: "custom",
      apiKey: "tok",
      model: "m",
      baseUrl: "http://localhost:11434/v1",
      authHeader: "X-Api-Key",
    });
    expect(unreachable).toMatchObject({ ok: false, error: { kind: "networkOrCors" } });
  });

  it("uses the presets for direct OpenAI and Anthropic, without a request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await testConnection({
      mode: "direct",
      provider: "anthropic",
      apiKey: "sk-ant",
      model: "claude-sonnet-5-5",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, source: "presets", latencyMs: null });
    expect(result.ok && result.models).toContain("claude-opus-5-5");
  });

  it("parseModelList ignores anything that is not { data: [{ id }] }", () => {
    expect(parseModelList({ object: "list" })).toEqual([]);
    expect(parseModelList(null)).toEqual([]);
  });
});

describe("modelsForConnection", () => {
  const base = { id: "c", name: "C", mode: "direct", apiKey: "k" } as const;

  it("offers the tested models when there are any, else the presets", () => {
    expect(
      modelsForConnection({ ...base, provider: "custom", model: "b", models: ["a", "b"] }),
    ).toEqual(["a", "b"]);
    expect(
      modelsForConnection({ ...base, provider: "anthropic", model: "claude-opus-5-5" }),
    ).toContain("claude-haiku-5-5");
  });

  it("always includes the current model", () => {
    expect(modelsForConnection({ ...base, provider: "custom", model: "x", models: ["a"] })).toEqual(
      ["x", "a"],
    );
  });
});
