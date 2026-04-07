import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseLLMResponse } from "./patch-parser";

describe("parseLLMResponse", () => {
  let randomUUIDSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomUUIDSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("00000000-0000-4000-8000-000000000001");
  });

  afterEach(() => {
    randomUUIDSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("returns message and patch when JSON has both", () => {
    const raw = JSON.stringify({
      message: "Hello",
      patch: {
        id: "p1",
        description: "d",
        actions: [{ type: "ADD_NODE", payload: { nodeType: "system", name: "A", parentId: null } }],
      },
    });
    const result = parseLLMResponse(raw);
    expect(result.message).toBe("Hello");
    expect(result.patch?.id).toBe("p1");
    expect(result.patch?.actions).toHaveLength(1);
  });

  it("returns message and null patch when patch is null", () => {
    const raw = JSON.stringify({ message: "No op", patch: null });
    const result = parseLLMResponse(raw);
    expect(result.message).toBe("No op");
    expect(result.patch).toBeNull();
  });

  it("strips ```json fences and parses the envelope", () => {
    const inner = JSON.stringify({
      message: "Fenced",
      patch: null,
    });
    const raw = "```json\n" + inner + "\n```";
    const result = parseLLMResponse(raw);
    expect(result.message).toBe("Fenced");
    expect(result.patch).toBeNull();
  });

  it("generates an id when patch id is empty", () => {
    const raw = JSON.stringify({
      message: "m",
      patch: {
        id: "   ",
        description: "d",
        actions: [],
      },
    });
    const result = parseLLMResponse(raw);
    expect(result.patch?.id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("converts write toolCalls into actions", () => {
    const raw = JSON.stringify({
      message: "Applied",
      patch: {
        id: "p1",
        description: "d",
        actions: [],
        toolCalls: [
          {
            tool: "add_node",
            parameters: { nodeType: "system", name: "N", parentId: null },
          },
        ],
      },
    });
    const result = parseLLMResponse(raw);
    expect(result.patch?.actions.some((a) => a.type === "ADD_NODE")).toBe(true);
  });

  it("logs read toolCalls and does not append them as actions", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const raw = JSON.stringify({
      message: "Read only",
      patch: {
        id: "p1",
        description: "d",
        actions: [],
        toolCalls: [
          {
            tool: "get_diagram_summary",
            parameters: {},
          },
        ],
      },
    });
    const result = parseLLMResponse(raw);
    expect(result.patch?.actions).toHaveLength(0);
    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it("uses fallback message for malformed JSON that looks like an object", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = '{"message": broken}';
    const result = parseLLMResponse(raw);
    expect(result.patch).toBeNull();
    expect(result.message).toBe("[Resposta não processada. Tente novamente.]");
    warnSpy.mockRestore();
  });

  it("extracts inner message when message is double-encoded JSON", () => {
    const inner = JSON.stringify({ message: "Inner text" });
    const raw = JSON.stringify({
      message: inner,
      patch: null,
    });
    const result = parseLLMResponse(raw);
    expect(result.message).toBe("Inner text");
  });

  it("returns raw text as message when there is no JSON envelope", () => {
    const raw = "Plain assistant reply";
    const result = parseLLMResponse(raw);
    expect(result.message).toBe("Plain assistant reply");
    expect(result.patch).toBeNull();
  });

  it("returns empty message and null patch for empty input", () => {
    expect(parseLLMResponse("")).toEqual({ message: "", patch: null });
    expect(parseLLMResponse("   ")).toEqual({ message: "", patch: null });
  });

  it("strips zero-width characters before parsing", () => {
    const inner = JSON.stringify({ message: "OK", patch: null });
    const raw = "\u200B" + inner + "\uFEFF";
    const result = parseLLMResponse(raw);
    expect(result.message).toBe("OK");
    expect(result.patch).toBeNull();
  });
});
