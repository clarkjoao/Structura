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

  it("returns patch kind when JSON has message and patch", () => {
    const raw = JSON.stringify({
      message: "Hello",
      patch: {
        id: "p1",
        description: "d",
        actions: [{ type: "ADD_NODE", payload: { nodeType: "system", name: "A", parentId: null } }],
      },
    });
    const result = parseLLMResponse(raw);
    expect(result.kind).toBe("patch");
    if (result.kind === "patch") {
      expect(result.message).toBe("Hello");
      expect(result.patch?.id).toBe("p1");
      expect(result.patch?.actions).toHaveLength(1);
    }
  });

  it("returns patch kind with null patch when patch is null", () => {
    const raw = JSON.stringify({ message: "No op", patch: null });
    const result = parseLLMResponse(raw);
    expect(result.kind).toBe("patch");
    if (result.kind === "patch") {
      expect(result.message).toBe("No op");
      expect(result.patch).toBeNull();
    }
  });

  it("strips ```json fences and parses the envelope", () => {
    const inner = JSON.stringify({
      message: "Fenced",
      patch: null,
    });
    const raw = "```json\n" + inner + "\n```";
    const result = parseLLMResponse(raw);
    expect(result.kind).toBe("patch");
    if (result.kind === "patch") {
      expect(result.message).toBe("Fenced");
      expect(result.patch).toBeNull();
    }
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
    expect(result.kind).toBe("patch");
    if (result.kind === "patch") {
      expect(result.patch?.id).toBe("00000000-0000-4000-8000-000000000001");
    }
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
    expect(result.kind).toBe("patch");
    if (result.kind === "patch") {
      expect(result.patch?.actions.some((a) => a.type === "ADD_NODE")).toBe(true);
    }
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
    expect(result.kind).toBe("patch");
    if (result.kind === "patch") {
      expect(result.patch?.actions).toHaveLength(0);
    }
    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it("uses fallback message for malformed JSON that looks like an object", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = '{"message": broken}';
    const result = parseLLMResponse(raw);
    expect(result.kind).toBe("text");
    if (result.kind === "text") {
      expect(result.message).toBe("[Resposta não processada. Tente novamente.]");
    }
    warnSpy.mockRestore();
  });

  it("extracts inner message when message is double-encoded JSON", () => {
    const inner = JSON.stringify({ message: "Inner text" });
    const raw = JSON.stringify({
      message: inner,
      patch: null,
    });
    const result = parseLLMResponse(raw);
    expect(result.kind).toBe("patch");
    if (result.kind === "patch") {
      expect(result.message).toBe("Inner text");
    }
  });

  it("returns text kind when there is no JSON envelope", () => {
    const raw = "Plain assistant reply";
    const result = parseLLMResponse(raw);
    expect(result.kind).toBe("text");
    if (result.kind === "text") {
      expect(result.message).toBe("Plain assistant reply");
    }
  });

  it("returns empty text for empty input", () => {
    expect(parseLLMResponse("")).toEqual({ kind: "text", message: "" });
    expect(parseLLMResponse("   ")).toEqual({ kind: "text", message: "" });
  });

  it("strips zero-width characters before parsing", () => {
    const inner = JSON.stringify({ message: "OK", patch: null });
    const raw = "\u200B" + inner + "\uFEFF";
    const result = parseLLMResponse(raw);
    expect(result.kind).toBe("patch");
    if (result.kind === "patch") {
      expect(result.message).toBe("OK");
      expect(result.patch).toBeNull();
    }
  });

  it("parses analysis mode JSON", () => {
    const raw = JSON.stringify({
      mode: "analysis",
      summary: "Exec summary",
      findings: [
        {
          severity: "high",
          category: "reliability",
          title: "Risk",
          detail: "Details",
          recommendation: "Fix it",
        },
      ],
      strengths: ["Good separation"],
      nextSteps: ["Add monitoring"],
    });
    const result = parseLLMResponse(raw);
    expect(result.kind).toBe("analysis");
    if (result.kind === "analysis") {
      expect(result.analysis.summary).toBe("Exec summary");
      expect(result.analysis.findings).toHaveLength(1);
      expect(result.analysis.strengths).toEqual(["Good separation"]);
      expect(result.analysis.nextSteps).toEqual(["Add monitoring"]);
    }
  });
});
