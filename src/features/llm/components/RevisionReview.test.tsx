import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { readGuided } from "@/features/diagram-kinds/guided/guided.model";
import { applyDiagramPatchAction } from "../apply-diagram-patch";
import { checkJourneyRevision, currentJourneyBase } from "../journey-outline";
import { useLLMStore } from "../store";
import type { PendingSuggestion } from "../types";
import { SuggestionCard } from "./SuggestionCard";

registerBuiltInDiagramKinds();

function journey() {
  const { diagram } = createKindDiagram({
    name: `Review ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  applyDiagramPatchAction({
    type: "ADD_JOURNEY_OUTLINE",
    payload: { outline: "## Descobrir\nUsuário: Busca\n## Comprar\nPaga\nEspera [1]" },
  });
  const names = () =>
    [...readGuided(useDiagramStore.getState().diagrams[diagram.id]!).steps.values()].map(
      (s) => s.name,
    );
  return { id: diagram.id, names };
}

/** A pending suggestion carrying a revision of the journey, in the assistant's store. */
function suggest(change: (text: string) => string): PendingSuggestion {
  const base = currentJourneyBase();
  const check = checkJourneyRevision(base, change(base!.text));
  if (!check.ok) throw new Error(check.errors.join());
  const suggestion: PendingSuggestion = {
    id: `s-${Math.random()}`,
    messageId: "m",
    patch: {
      id: "p",
      description: "Revision",
      actions: [{ type: "REVISE_JOURNEY", payload: { outline: check.revision.outline } }],
    },
    status: "pending",
    revision: check.revision,
  };
  useLLMStore.setState({ pendingSuggestions: [suggestion], pendingPreviews: [] });
  return suggestion;
}

function Card({ id }: { id: string }) {
  const suggestion = useLLMStore((s) => s.pendingSuggestions.find((p) => p.id === id))!;
  return (
    <SuggestionCard
      suggestion={suggestion}
      onAccept={(sid) => useLLMStore.getState().acceptSuggestion(sid)}
      onReject={(sid) => useLLMStore.getState().rejectSuggestion(sid)}
    />
  );
}

describe("reviewing a journey revision", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
  });

  it("lists the changes by phase, one checkbox per group, with the reason", () => {
    journey();
    const { id } = suggest((t) =>
      t
        .replace(/^(.*)Busca \{#s1\}$/m, "# why: plainer\n$1Procura {#s1}")
        .replace("Espera [1] {#s3}", "Espera [4] {#s3}\nRecebe"),
    );
    render(<Card id={id} />);
    const phases = screen
      .getAllByTestId("revision-phase")
      .map((p) => p.querySelector("h5")!.textContent);
    expect(phases).toEqual(["Descobrir", "Comprar"]);
    expect(screen.getByText("plainer")).toBeInTheDocument();
    expect(screen.getAllByTestId("revision-group")).toHaveLength(3);
    expect(screen.getByTestId("suggestion-accept")).toHaveTextContent("Apply 3 changes");
  });

  it("applies only what stays ticked, in one undo step", () => {
    const { names } = journey();
    const { id } = suggest((t) =>
      t.replace("Busca {#s1}", "Procura {#s1}").replace("Paga {#s2}\n", ""),
    );
    render(<Card id={id} />);
    const removal = screen
      .getAllByTestId("revision-group")
      .find((g) => g.textContent?.includes("Remove"))!;
    fireEvent.click(removal.querySelector("input")!);
    expect(screen.getByTestId("suggestion-accept")).toHaveTextContent("Apply 1 change");
    // The removal's preview is gone with its tick.
    expect(
      useLLMStore.getState().pendingPreviews.find((p) => p.tone === "remove")!.nodeIds,
    ).toEqual([]);
    act(() => fireEvent.click(screen.getByTestId("suggestion-accept")));
    expect(names()).toEqual(expect.arrayContaining(["Procura", "Paga", "Espera"]));
    expect(useLLMStore.getState().pendingPreviews).toEqual([]);
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
    act(() => useDiagramStore.getState().undo());
    expect(names()).toEqual(expect.arrayContaining(["Busca", "Paga"]));
  });

  it("unticks steps added together as one group", () => {
    journey();
    const { id } = suggest((t) => `${t}Recebe\nAvalia\n`);
    render(<Card id={id} />);
    const groups = screen.getAllByTestId("revision-group");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveTextContent("Add “Recebe”");
    expect(groups[0]).toHaveTextContent("Add “Avalia”");
  });

  it("shows a change whose step is gone as no longer applicable", () => {
    const { id: diagramId } = journey();
    const { id } = suggest((t) =>
      t
        .replace("Espera [1] {#s3}", "Espera mais [1] {#s3}")
        .replace("Busca {#s1}", "Procura {#s1}"),
    );
    render(<Card id={id} />);
    const espera = Object.values(
      useDiagramStore.getState().diagrams[diagramId]!.snapshot.components,
    ).find((c) => c.name === "Espera")!;
    act(() => {
      useDiagramStore.getState().applyKindEdit({ remove: [espera.id] });
    });
    const stale = screen
      .getAllByTestId("revision-group")
      .find((g) => g.textContent?.includes("Espera"))!;
    expect(stale).toHaveTextContent("No longer applicable");
    expect(stale.querySelector("input")).toBeDisabled();
    expect(screen.getByTestId("suggestion-accept")).toHaveTextContent("Apply 1 change");
  });
});
