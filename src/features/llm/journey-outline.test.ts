import { beforeEach, describe, expect, it } from "vitest";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { readGuided } from "@/features/diagram-kinds/guided/guided.model";
import { applyDiagramPatchAction } from "./apply-diagram-patch";
import { parseLLMResponse } from "./patch-parser";
import { buildSystemPrompt } from "./prompt-builder";
import { currentJourneyOutline } from "./journey-outline";

registerBuiltInDiagramKinds();

function guided() {
  const { diagram } = createKindDiagram({
    name: `Assistant ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  const names = () =>
    [...readGuided(useDiagramStore.getState().diagrams[diagram.id]!).steps.values()].map(
      (s) => s.name,
    );
  return { id: diagram.id, names };
}

describe("the assistant's journey outline", () => {
  beforeEach(() => useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 }));

  it("parses the tool call into an action", () => {
    const parsed = parseLLMResponse(
      JSON.stringify({
        mode: "patch",
        message: "Journey",
        patch: {
          id: "p",
          description: "d",
          actions: [],
          toolCalls: [{ tool: "add_journey_outline", parameters: { outline: "A\nB" } }],
        },
      }),
    );
    expect(parsed.kind === "patch" && parsed.patch?.actions).toEqual([
      { type: "ADD_JOURNEY_OUTLINE", payload: { outline: "A\nB" } },
    ]);
  });

  it("adds a valid outline in one undo step and reports what it added", () => {
    const { names } = guided();
    const before = names().length;
    const applied = applyDiagramPatchAction({
      type: "ADD_JOURNEY_OUTLINE",
      payload: { outline: "API: Valida\n? Ok\n  sim -> Responde\n  não -> ! Recusa" },
    });
    expect(applied.skipped).toBeUndefined();
    expect(applied.toolResult).toMatchObject({
      type: "ADD_JOURNEY_OUTLINE",
      data: { added: { steps: 4, decisions: 1, lanes: 1 } },
    });
    expect(names()).toEqual(expect.arrayContaining(["Valida", "Ok", "Responde", "Recusa"]));
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
    useDiagramStore.getState().undo();
    expect(names()).toHaveLength(before);
  });

  it("changes nothing for an outline with errors, and returns them by line", () => {
    const { names } = guided();
    const before = names().length;
    const applied = applyDiagramPatchAction({
      type: "ADD_JOURNEY_OUTLINE",
      payload: { outline: "A\n-> @Nada" },
    });
    expect(applied.skipped).toBe(true);
    expect(applied.skipReason).toMatch(/line 2/);
    expect(names()).toHaveLength(before);
  });

  it("adds a Mermaid swimlane block through the same tool, and drops one with errors", () => {
    const { names } = guided();
    const applied = applyDiagramPatchAction({
      type: "ADD_JOURNEY_OUTLINE",
      payload: {
        outline:
          "swimlane-beta\n  subgraph API\n    v[Valida] --> r{Ok?}\n  end\n  r -->|sim| s[Salva]",
      },
    });
    expect(applied.skipped).toBeUndefined();
    expect(names()).toEqual(expect.arrayContaining(["Valida", "Ok?", "Salva"]));
    const bad = applyDiagramPatchAction({
      type: "ADD_JOURNEY_OUTLINE",
      payload: { outline: "swimlane-beta\n  subgraph API\n    v[Valida]" },
    });
    expect(bad.skipped).toBe(true);
    expect(bad.skipReason).toMatch(/line 2/);
    expect(buildSystemPrompt("ctx", "en", currentJourneyOutline())).toContain("swimlane-beta");
  });

  it("offers the tool and the current journey only on a guided diagram", () => {
    guided();
    const outline = currentJourneyOutline();
    expect(outline).not.toBeNull();
    const withJourney = buildSystemPrompt("ctx", "en", outline);
    expect(withJourney).toContain("Tool: add_journey_outline");
    expect(withJourney).toContain("Current journey as an outline");

    const c4 = useDiagramStore.getState().addDiagram("C4", "context");
    useDiagramStore.getState().openDiagram(c4.id);
    expect(currentJourneyOutline()).toBeNull();
    const plain = buildSystemPrompt("ctx", "en", currentJourneyOutline());
    expect(plain).not.toContain("add_journey_outline");
    expect(plain).not.toContain("Guided journey diagram");
  });
});
