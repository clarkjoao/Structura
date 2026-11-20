import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { readGuided } from "@/features/diagram-kinds/guided/guided.model";
import { KindActionsSection } from "./KindActionsSection";
import { kindMenuItemsFor } from "../../../chrome/kindElementActions";

registerBuiltInDiagramKinds();

function setup() {
  const { diagram, selectId } = createKindDiagram({
    name: `Actions ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  const d = () => useDiagramStore.getState().diagrams[diagram.id]!;
  return { d, startId: selectId!, lanes: readGuided(d()).lanes.map((l) => l.id) };
}

describe("guided element actions", () => {
  beforeEach(() => useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 }));

  it("moves a step to another lane from the inspector", () => {
    const { d, startId, lanes } = setup();
    render(<KindActionsSection elementId={startId} />);
    fireEvent.click(screen.getByRole("button", { name: /System|Sistema/ }));
    expect(readGuided(d()).laneOf.get(startId)).toBe(lanes[1]);
  });

  it("offers lane controls on a lane, and adds one after it", () => {
    const { d, lanes } = setup();
    render(<KindActionsSection elementId={lanes[0]!} />);
    fireEvent.click(screen.getByRole("button", { name: /Add lane|Adicionar raia/ }));
    expect(readGuided(d()).lanes).toHaveLength(3);
    expect(readGuided(d()).lanes[2]!.id).toBe(lanes[1]);
  });

  it("puts the kind's commands and actions in the context menu, and nothing when freehand", () => {
    const { d, startId } = setup();
    const ids = kindMenuItemsFor(d(), startId, [startId]).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(["guided.next", "guided.branch"]));
    expect(ids.some((id) => id.startsWith("guided.moveTo."))).toBe(true);
    useDiagramStore.getState().setKindMode(d().id, "freehand");
    expect(kindMenuItemsFor(d(), startId, [startId])).toEqual([]);
  });
});
