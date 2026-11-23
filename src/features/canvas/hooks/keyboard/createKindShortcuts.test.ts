import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { chordOf, createKindShortcuts } from "./createKindShortcuts";

registerBuiltInDiagramKinds();

function key(
  k: string,
  mods: Partial<Pick<KeyboardEvent, "shiftKey" | "altKey" | "ctrlKey" | "metaKey">> = {},
) {
  return new KeyboardEvent("keydown", { key: k, cancelable: true, ...mods });
}

function setup() {
  const { diagram, selectId } = createKindDiagram({
    name: `Keys ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  let selected: string[] = selectId ? [selectId] : [];
  const requestEditLabel = vi.fn();
  const { handler, fromLabelField } = createKindShortcuts({
    getDiagram: () => useDiagramStore.getState().diagrams[diagram.id],
    getSelectedIds: () => selected,
    select: (id) => {
      selected = [id];
    },
    requestEditLabel,
  });
  return {
    diagramId: diagram.id,
    handler,
    fromLabelField,
    requestEditLabel,
    selected: () => selected,
    setSelected: (ids: string[]) => {
      selected = ids;
    },
  };
}

describe("kind shortcuts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
  });

  it("spells chords the way kind commands declare them", () => {
    expect(chordOf(key("Tab"))).toBe("Tab");
    expect(chordOf(key("Tab", { shiftKey: true }))).toBe("Shift+Tab");
    expect(chordOf(key("ArrowUp", { altKey: true }))).toBe("Alt+ArrowUp");
  });

  it("Tab on the selected step adds the next one, selects it and opens its label", () => {
    const s = setup();
    const start = s.selected()[0]!;
    expect(s.handler(key("Tab"))).toBe(true);
    const next = s.selected()[0]!;
    expect(next).not.toBe(start);
    const d = useDiagramStore.getState().diagrams[s.diagramId]!;
    expect(
      Object.values(d.snapshot.connections).some(
        (c) => c.sourceId === start && c.targetId === next,
      ),
    ).toBe(true);
    expect(s.requestEditLabel).toHaveBeenCalledWith(next);
  });

  it("lets Tab through when nothing the kind acts on is selected", () => {
    const s = setup();
    s.setSelected([]);
    expect(s.handler(key("Tab"))).toBe(false);
  });

  it("does nothing on a freehand diagram, or a guided one edited freehand", () => {
    const s = setup();
    useDiagramStore.getState().setKindMode(s.diagramId, "freehand");
    expect(s.handler(key("Tab"))).toBe(false);
  });

  it("Tab from the name a gesture opened commits it and chains the next step", () => {
    const s = setup();
    s.handler(key("Tab"));
    const named = s.selected()[0]!;
    vi.runAllTimers();

    const title = document.createElement("textarea");
    title.dataset.panelTitle = "";
    const commit = vi.fn(() => useDiagramStore.getState().updateComponent(named, { name: "Pay" }));
    title.addEventListener("blur", commit);
    document.body.appendChild(title);
    title.focus();

    const event = key("Tab");
    Object.defineProperty(event, "target", { value: title });
    expect(s.fromLabelField(event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(commit).toHaveBeenCalled();
    const next = s.selected()[0]!;
    expect(next).not.toBe(named);
    const d = useDiagramStore.getState().diagrams[s.diagramId]!;
    expect(d.snapshot.components[named]!.name).toBe("Pay");
    expect(
      Object.values(d.snapshot.connections).some(
        (c) => c.sourceId === named && c.targetId === next,
      ),
    ).toBe(true);
    title.remove();
  });

  it("leaves a name field alone unless a gesture just opened it", () => {
    const s = setup();
    const title = document.createElement("textarea");
    title.dataset.panelTitle = "";
    const event = key("Tab");
    Object.defineProperty(event, "target", { value: title });
    expect(s.fromLabelField(event)).toBe(false);

    s.handler(key("Tab"));
    const other = document.createElement("textarea");
    const onOther = key("Tab");
    Object.defineProperty(onOther, "target", { value: other });
    expect(s.fromLabelField(onOther)).toBe(false);
  });
});
