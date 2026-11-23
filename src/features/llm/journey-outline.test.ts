import { beforeEach, describe, expect, it } from "vitest";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { readGuided } from "@/features/diagram-kinds/guided/guided.model";
import { applyDiagramPatchAction } from "./apply-diagram-patch";
import { parseLLMResponse } from "./patch-parser";
import { buildSystemPrompt } from "./prompt-builder";
import {
  applyJourneyRevision,
  checkJourneyRevision,
  currentJourneyBase,
  currentJourneyOutline,
  currentRevisionChanges,
  journeyRevisionPreviews,
} from "./journey-outline";

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

  it("carries the experience scores in the current journey and documents them", () => {
    guided();
    applyDiagramPatchAction({
      type: "ADD_JOURNEY_OUTLINE",
      payload: { outline: "API: Cobra [2]" },
    });
    const prompt = buildSystemPrompt("ctx", "en", currentJourneyOutline());
    expect(prompt).toContain("Cobra [2]");
    expect(prompt).toContain("pain points");
    applyDiagramPatchAction({
      type: "ADD_JOURNEY_OUTLINE",
      payload: { outline: "## Comprar\nAPI: Confirma" },
    });
    const withPhase = buildSystemPrompt("ctx", "en", currentJourneyOutline());
    expect(withPhase).toMatch(/## Comprar\n.*Confirma/);
    expect(withPhase).toContain("`## Phase name`");
    expect(withPhase).toContain("`{#s4}`");
    expect(withPhase).toContain("`Lane, Other: Step`");
    expect(withPhase).toContain("line of visibility");
    // The current journey carries its handles (spec guided-assistant-revisions).
    expect(withPhase).toMatch(/Confirma \{#s\d+\}/);
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

describe("the assistant's journey revisions", () => {
  beforeEach(() => useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 }));

  const withJourney = () => {
    const g = guided();
    applyDiagramPatchAction({
      type: "ADD_JOURNEY_OUTLINE",
      payload: { outline: "Usuário: Paga\nEspera [1]\nRecebe" },
    });
    return g;
  };

  it("offers revise_journey with add_journey_outline, only on a guided diagram", () => {
    withJourney();
    const prompt = buildSystemPrompt("ctx", "en", currentJourneyOutline());
    expect(prompt).toContain("Tool: revise_journey");
    expect(prompt).toMatch(/Paga \{#s1\}/);
    expect(prompt).toContain("# why:");
    expect(buildSystemPrompt("ctx", "en", null)).not.toContain("Tool: revise_journey");
  });

  it("parses the tool call into an action", () => {
    const parsed = parseLLMResponse(
      JSON.stringify({
        mode: "patch",
        message: "Revision",
        patch: {
          id: "p",
          description: "d",
          actions: [],
          toolCalls: [
            { tool: "revise_journey", parameters: { outline: "Paga {#s1}" } },
            { tool: "revise_journey", parameters: {} },
          ],
        },
      }),
    );
    expect(parsed.kind === "patch" && parsed.patch?.actions).toEqual([
      { type: "REVISE_JOURNEY", payload: { outline: "Paga {#s1}" } },
    ]);
  });

  it("reads a revision against the journey the assistant saw, or tells its errors back", () => {
    const { names } = withJourney();
    const base = currentJourneyBase();
    const bad = checkJourneyRevision(base, base!.text.replace("{#s1}", "{#s9}"));
    expect(bad.ok === false && bad.errors.join()).toMatch(/line \d+/);
    expect(checkJourneyRevision(base, base!.text).ok).toBe(false);
    const good = checkJourneyRevision(
      base,
      base!.text
        .replace("Espera [1] {#s2}", "# why: show progress\nEspera com progresso [3] {#s2}")
        .replace("Recebe {#s3}\n", ""),
    );
    if (!good.ok) throw new Error(good.errors.join());
    expect(names()).toContain("Espera");
    const kinds = good.revision.initial.map((c) => c.kind);
    expect(kinds).toEqual(expect.arrayContaining(["rename", "score", "remove"]));
    expect(good.revision.initial.find((c) => c.kind === "rename")!.reason).toBe("show progress");
  });

  it("applies only the groups left ticked, as one undo step, and previews them", () => {
    const { names } = withJourney();
    const base = currentJourneyBase();
    const check = checkJourneyRevision(
      base,
      base!.text
        .replace("Espera [1] {#s2}", "Espera menos [1] {#s2}")
        .replace("Recebe {#s3}\n", ""),
    );
    if (!check.ok) throw new Error(check.errors.join());
    const removal = check.revision.initial.find((c) => c.kind === "remove")!;
    const revision = { ...check.revision, unticked: [removal.group ?? removal.key] };
    const previews = journeyRevisionPreviews("s", revision);
    expect(previews.find((p) => p.tone === "change")!.nodeIds).toHaveLength(1);
    expect(previews.find((p) => p.tone === "remove")!.nodeIds).toEqual([]);
    expect(previews.every((p) => p.toolbars === false)).toBe(true);
    expect(applyJourneyRevision(revision)).toBe(1);
    expect(names()).toEqual(expect.arrayContaining(["Espera menos", "Recebe"]));
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
    useDiagramStore.getState().undo();
    expect(names()).toEqual(expect.arrayContaining(["Espera", "Recebe"]));
  });

  it("drops a change whose step was deleted since", () => {
    const { id } = withJourney();
    const base = currentJourneyBase();
    const check = checkJourneyRevision(
      base,
      base!.text
        .replace("Espera [1] {#s2}", "Espera menos [1] {#s2}")
        .replace("Paga {#s1}", "Paga já {#s1}"),
    );
    if (!check.ok) throw new Error(check.errors.join());
    const espera = Object.values(useDiagramStore.getState().diagrams[id]!.snapshot.components).find(
      (c) => c.name === "Espera",
    )!;
    useDiagramStore.getState().applyKindEdit({ remove: [espera.id] });
    const now = currentRevisionChanges(check.revision).map((c) => c.kind);
    expect(now).toContain("rename");
    expect(currentRevisionChanges(check.revision).some((c) => c.elementId === espera.id)).toBe(
      false,
    );
  });
});
