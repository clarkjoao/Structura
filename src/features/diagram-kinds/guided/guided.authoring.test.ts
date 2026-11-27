import { describe, expect, it } from "vitest";
import { checkFlowInvariants, getFlowParticipants } from "@/features/diagram/utils/flow-traversal";
import { kindContextFor } from "../context";
import { guidedKind } from "./guided.kind";
import { guidedHarness } from "./guided.harness";
import { guidedAddLane, guidedChangeShape, guidedMoveLane, guidedRemoveLane } from "./guided.edits";
import { isGuidedDecision } from "./guided.model";

describe("guided creation", () => {
  it("starts with two named lanes and a selected start step in the first", () => {
    const h = guidedHarness();
    const reading = h.reading();
    expect(reading.lanes.map((l) => l.name)).toEqual(["User", "System"]);
    expect(reading.laneOf.get(h.startId)).toBe(h.laneIds[0]);
    expect(h.nameOf(h.startId)).toBe("Start");
    // The swimlane header shows the lane's label: it follows the name.
    expect(reading.lanes[0]!.swimlane?.laneLabel).toBe("User");
    expect(h.diagram().kind).toBe("guided");
    expect(guidedKind.conforms(h.diagram(), kindContextFor(h.diagram()))).toEqual([]);
  });
});

describe("Tab adds the next step", () => {
  it("appends a connected step in the same lane, selected", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    h.rename(a, "Abre app");
    expect(h.reading().laneOf.get(a)).toBe(h.laneIds[0]);
    expect(h.sequence()).toEqual(["Start", "Abre app"]);
  });

  it("inserts between a step and its successor", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    h.rename(a, "Abre app");
    const b = h.run("guided.next", [a])!;
    h.rename(b, "Escolhe");
    const inserted = h.run("guided.next", [a])!;
    h.rename(inserted, "Novo");
    expect(h.sequence()).toEqual(["Start", "Abre app", "Novo", "Escolhe"]);
  });

  it("is one undo step", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const before = h.absolute(h.startId);
    h.store.setState({ _lastUndoRedoTimestamp: 0 });
    h.store.getState().undo();
    expect(h.diagram().snapshot.components[a]).toBeUndefined();
    expect(h.absolute(h.startId)).toEqual(before);
    expect(h.sequence()).toEqual(["Start"]);
  });

  it("is refused on an end step", () => {
    const h = guidedHarness();
    const end = h.run("guided.next", [h.startId])!;
    h.apply({ update: [{ id: end, flowShape: "end" }] });
    expect(h.refusalOf("guided.next", [end])).toEqual({
      key: "diagramKinds.guided.refused.endHasNoNext",
    });
  });
});

describe("Shift+Tab adds a branch", () => {
  it("inserts a decision after a task, keeping the successor as the first exit", () => {
    const h = guidedHarness();
    const valida = h.run("guided.next", [h.startId])!;
    h.rename(valida, "Valida");
    const salva = h.run("guided.next", [valida])!;
    h.rename(salva, "Salva");
    const branch = h.run("guided.branch", [valida])!;
    h.rename(branch, "Erro");

    const reading = h.reading();
    const [decisionExit] = reading.outgoing.get(valida)!;
    const decision = decisionExit!.targetId;
    expect(isGuidedDecision(reading.steps.get(decision)!)).toBe(true);
    expect(
      reading.outgoing
        .get(decision)!
        .map((c) => h.nameOf(c.targetId))
        .sort(),
    ).toEqual(["Erro", "Salva"]);
  });

  it("adds a new exit on a decision", () => {
    const h = guidedHarness();
    const step = h.run("guided.next", [h.startId])!;
    const first = h.run("guided.branch", [step])!;
    const decision = h.reading().incoming.get(first)![0]!.sourceId;
    h.run("guided.branch", [decision]);
    h.run("guided.next", [decision]);
    expect(h.reading().outgoing.get(decision)).toHaveLength(3);
  });
});

describe("moving between lanes", () => {
  it("Alt+↓ moves the step to the lane below, keeping its connections", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const b = h.run("guided.next", [a])!;
    h.run("guided.laneDown", [a]);
    const reading = h.reading();
    expect(reading.laneOf.get(a)).toBe(h.laneIds[1]);
    expect(reading.incoming.get(a)![0]!.sourceId).toBe(h.startId);
    expect(reading.outgoing.get(a)![0]!.targetId).toBe(b);
  });

  it("does nothing past the edge", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const past = h.store.getState().past.length;
    h.run("guided.laneUp", [a]);
    expect(h.reading().laneOf.get(a)).toBe(h.laneIds[0]);
    expect(h.store.getState().past.length).toBe(past);
  });
});

describe("Delete reconnects the sequence", () => {
  it("sews A → C with the label B → C had", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const b = h.run("guided.next", [a])!;
    const c = h.run("guided.next", [b])!;
    const bc = h.reading().outgoing.get(b)![0]!;
    h.label(bc.id, "pedido");
    h.run("guided.delete", [b]);
    const out = h.reading().outgoing.get(a)!;
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ targetId: c, label: "pedido" });
  });

  it("sews around several selected steps in a row: A → D", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const b = h.run("guided.next", [a])!;
    const c = h.run("guided.next", [b])!;
    const d = h.run("guided.next", [c])!;
    h.run("guided.delete", [b, c]);
    expect(h.reading().steps.has(b) || h.reading().steps.has(c)).toBe(false);
    const out = h.reading().outgoing.get(a)!;
    expect(out).toHaveLength(1);
    expect(out[0]!.targetId).toBe(d);
  });

  it("sews each gap when the selected steps are apart", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const b = h.run("guided.next", [a])!;
    const c = h.run("guided.next", [b])!;
    const d = h.run("guided.next", [c])!;
    const e = h.run("guided.next", [d])!;
    h.run("guided.delete", [b, d]);
    expect(h.reading().outgoing.get(a)![0]!.targetId).toBe(c);
    expect(h.reading().outgoing.get(c)![0]!.targetId).toBe(e);
  });

  it("lets a mixed selection fall through to the canvas delete", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const command = guidedKind.commands!.find((c) => c.id === "guided.delete")!;
    const ctx = (ids: string[]) => ({
      ...kindContextFor(h.diagram()),
      diagram: h.diagram(),
      selectedIds: ids,
    });
    expect(command.enabled(ctx([a]))).toBe(true);
    expect(command.enabled(ctx([a, h.laneIds[0]!]))).toBe(false);
  });

  it("refuses to delete the only start", () => {
    const h = guidedHarness();
    expect(h.refusalOf("guided.delete", [h.startId])).toEqual({
      key: "diagramKinds.guided.refused.keepStart",
    });
  });
});

describe("Enter labels a decision's exits", () => {
  const decisionWithTwoExits = () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    h.run("guided.next", [a]);
    h.run("guided.branch", [a]);
    const decision = [...h.reading().steps.values()].find((s) => isGuidedDecision(s))!;
    const exits = h.reading().outgoing.get(decision.id)!;
    return { h, decision: decision.id, exits };
  };
  const outcomeOf = (h: ReturnType<typeof guidedHarness>, ids: string[]) =>
    guidedKind
      .commands!.find((c) => c.id === "guided.labelExit")!
      .run({
        ...kindContextFor(h.diagram()),
        diagram: h.diagram(),
        selectedIds: ids,
      });

  it("opens the first unlabelled exit, then the next, then returns to the decision", () => {
    const { h, decision, exits } = decisionWithTwoExits();
    expect(exits).toHaveLength(2);
    for (const exit of exits) h.label(exit.id, "");
    const [first, second] = exits as [(typeof exits)[0], (typeof exits)[0]];
    expect(outcomeOf(h, [decision])).toMatchObject({ selectConnection: first.id, editLabel: true });
    h.label(first.id, "yes");
    expect(outcomeOf(h, [first.id])).toMatchObject({
      selectConnection: second.id,
      editLabel: true,
    });
    h.label(second.id, "no");
    expect(outcomeOf(h, [second.id])).toMatchObject({ select: decision });
    // All labelled: Enter on the decision reopens its first exit.
    expect(outcomeOf(h, [decision])).toMatchObject({ selectConnection: first.id });
  });

  it("is only offered on a decision or one of its exits", () => {
    const { h, decision, exits } = decisionWithTwoExits();
    const command = guidedKind.commands!.find((c) => c.id === "guided.labelExit")!;
    const enabled = (ids: string[]) =>
      command.enabled({ ...kindContextFor(h.diagram()), diagram: h.diagram(), selectedIds: ids });
    expect(enabled([decision])).toBe(true);
    expect(enabled([exits[0]!.id])).toBe(true);
    expect(enabled([h.startId])).toBe(false);
  });
});

describe("lanes", () => {
  it("removing a lane moves its steps to the lane above", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    h.run("guided.laneDown", [a]);
    const edit = guidedRemoveLane(h.diagram(), h.laneIds[1]!);
    expect("refused" in edit).toBe(false);
    if (!("refused" in edit)) h.apply(edit);
    expect(h.reading().lanes).toHaveLength(1);
    expect(h.reading().laneOf.get(a)).toBe(h.laneIds[0]);
    expect(h.reading().incoming.get(a)![0]!.sourceId).toBe(h.startId);
  });

  it("keeps the last lane", () => {
    const h = guidedHarness();
    const edit = guidedRemoveLane(h.diagram(), h.laneIds[1]!);
    if (!("refused" in edit)) h.apply(edit);
    expect(guidedRemoveLane(h.diagram(), h.laneIds[0]!)).toEqual({
      refused: { key: "diagramKinds.guided.refused.keepLastLane" },
    });
  });

  it("adds a lane after another and reorders lanes", () => {
    const h = guidedHarness();
    h.apply(guidedAddLane(h.diagram(), "API", h.laneIds[0]));
    expect(h.reading().lanes.map((l) => l.name)).toEqual(["User", "API", "System"]);
    const api = h.reading().lanes[1]!.id;
    h.apply(guidedMoveLane(h.diagram(), api, 1));
    expect(h.reading().lanes.map((l) => l.name)).toEqual(["User", "System", "API"]);
  });
});

describe("conformance", () => {
  const issues = (h: ReturnType<typeof guidedHarness>) =>
    guidedKind.conforms(h.diagram(), kindContextFor(h.diagram())).map((i) => i.code);

  it("reports a second start", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    h.apply({ update: [{ id: a, flowShape: "start" }] });
    expect(issues(h)).toEqual(["extraStart"]);
  });

  it("reports an element outside the lanes and a cloud element", () => {
    const h = guidedHarness();
    h.apply({ add: [{ key: "x", type: "system", name: "System", parent: null, x: 0, y: 900 }] });
    expect(issues(h)).toContain("outsideLane");
  });

  it("ignores free text and notes", () => {
    const h = guidedHarness();
    h.apply({ add: [{ key: "n", type: "note", name: "Why", parent: null, x: 0, y: 900 }] });
    expect(issues(h)).toEqual([]);
  });

  it("reports an element whose type is not registered", () => {
    const h = guidedHarness();
    h.apply({
      add: [{ key: "u", type: "acme/widget", name: "Widget", parent: h.laneIds[0]!, x: 0, y: 0 }],
    });
    expect(issues(h)).toContain("unknownElement");
  });

  it("keeps the lane order when the lanes are moved around (an Arrange, a drag, a peer)", () => {
    const h = guidedHarness();
    const [first, second] = h.laneIds as [string, string];
    const a = h.diagram().nodeLayouts[first]!;
    const b = h.diagram().nodeLayouts[second]!;
    h.apply({
      move: [
        { id: first, x: a.x, y: b.y + 10 },
        { id: second, x: b.x, y: a.y },
      ],
    });
    expect(h.reading().lanes.map((l) => l.id)).toEqual([first, second]);
    // The arrangement puts the bands back in that order.
    expect(h.absolute(first).y).toBeLessThan(h.absolute(second).y);
    expect(h.diagram().kindData?.laneOrder).toEqual([first, second]);
  });

  it("comes back from freehand in its lane order, whatever an Arrange did there", () => {
    const h = guidedHarness();
    const [first, second] = h.laneIds as [string, string];
    const a = h.diagram().nodeLayouts[first]!;
    const b = h.diagram().nodeLayouts[second]!;
    h.store.getState().setKindMode(h.diagramId, "freehand");
    // An Arrange (ELK) while freehand stacks the lanes the other way round.
    h.store.getState().applyAutoLayout(
      [
        { elementId: first, x: a.x, y: b.y + 10 },
        { elementId: second, x: b.x, y: a.y },
      ],
      undefined,
      { history: false },
    );
    const derived = guidedKind.derive!(h.diagram(), kindContextFor(h.diagram())) ?? undefined;
    h.store.getState().setKindMode(h.diagramId, "kind", derived);
    h.settle();
    expect(h.reading().lanes.map((l) => l.id)).toEqual([first, second]);
    expect(h.absolute(first).y).toBeLessThan(h.absolute(second).y);
  });

  it("reads lanes by position when no order is stored yet (an older or imported diagram)", () => {
    const h = guidedHarness();
    const [first, second] = h.laneIds as [string, string];
    const { laneOrder: _order, ...rest } = h.diagram().kindData ?? {};
    const a = h.diagram().nodeLayouts[first]!;
    const b = h.diagram().nodeLayouts[second]!;
    h.store.getState().applyKindEdit(
      {
        kindData: rest,
        move: [
          { id: first, x: a.x, y: b.y + 10 },
          { id: second, x: b.x, y: a.y },
        ],
      },
      { history: false },
    );
    expect(h.reading().lanes.map((l) => l.id)).toEqual([second, first]);
  });
});

describe("derived flow", () => {
  it("reads like a recording: a step on each connection travelled, between the journey steps", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const b = h.run("guided.next", [a])!;
    const flow = h.flow()!;
    const travelled = [h.startId, a].map((id) => h.reading().outgoing.get(id)![0]!.id);
    // Playback lights the lines as well as the boxes.
    expect([...getFlowParticipants(flow).connectionIds].sort()).toEqual([...travelled].sort());
    const kinds: string[] = [];
    let id = flow.entryStepId;
    while (id) {
      const step = flow.steps[id]!;
      kinds.push(step.componentId ?? `→${step.connectionId}`);
      id = step.next;
    }
    expect(kinds).toEqual([h.startId, `→${travelled[0]}`, a, `→${travelled[1]}`, b]);
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("makes a decision a condition with labelled branches", () => {
    const h = guidedHarness();
    const step = h.run("guided.next", [h.startId])!;
    h.run("guided.branch", [step]);
    const decision = h.reading().outgoing.get(step)![0]!.targetId;
    h.run("guided.next", [decision]);
    const [sim, nao] = h.reading().outgoing.get(decision)!;
    h.label(sim!.id, "sim");
    h.label(nao!.id, "não");
    const flow = h.flow()!;
    const condition = Object.values(flow.steps).find((s) => s.componentId === decision)!;
    expect(condition.type).toBe("condition");
    expect(condition.branches!.map((b) => b.label).sort()).toEqual(["não", "sim"]);
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("keeps a step's content across an insert before it", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const flowId = h.flow()!.id;
    const stepOfA = Object.values(h.flow()!.steps).find((s) => s.componentId === a)!;
    h.apply({
      flows: {
        set: [
          {
            ...h.flow()!,
            steps: { ...h.flow()!.steps, [stepOfA.id]: { ...stepOfA, payload: '{"id":1}' } },
          },
        ],
      },
    });
    const inserted = h.run("guided.next", [h.startId])!;
    const flow = h.diagram().snapshot.flows[flowId]!;
    expect(Object.values(flow.steps).find((s) => s.componentId === a)!.payload).toBe('{"id":1}');
    expect(
      Object.values(flow.steps).find((s) => s.componentId === inserted)!.payload,
    ).toBeUndefined();
  });

  it("leaves a retry back-edge out of the flow", () => {
    const h = guidedHarness();
    const valida = h.run("guided.next", [h.startId])!;
    const cobra = h.run("guided.next", [valida])!;
    const fim = h.run("guided.next", [cobra])!;
    h.apply({ connect: [{ source: cobra, target: valida, label: "retry" }] });
    const flow = h.flow()!;
    expect(checkFlowInvariants(flow)).toEqual([]);
    expect(Object.values(flow.steps).map((s) => s.componentId)).toContain(fim);
  });

  it("recreates a missing derived flow", () => {
    const h = guidedHarness();
    const flowId = h.flow()!.id;
    h.apply({ flows: { remove: [flowId] } });
    h.settle();
    expect(h.flow()).toBeDefined();
    expect(h.flow()!.entryStepId).toBeDefined();
  });
});

describe("quiet checks", () => {
  it("marks an unlabelled decision exit until it is labelled", () => {
    const h = guidedHarness();
    const step = h.run("guided.next", [h.startId])!;
    h.run("guided.branch", [step]);
    const decision = h.reading().outgoing.get(step)![0]!.targetId;
    const exit = h.reading().outgoing.get(decision)![0]!;
    const unlabelled = () =>
      guidedKind.checks!(h.diagram())
        .filter((m) => m.code === "unlabelledExit")
        .map((m) => m.elementId);
    expect(unlabelled()).toContain(exit.id);
    h.label(exit.id, "ok");
    expect(unlabelled()).not.toContain(exit.id);
  });
});

describe("round trip with recorded flows", () => {
  it("keeps a flow recorded in freehand mode when the diagram returns to guided", () => {
    const h = guidedHarness();
    h.store.getState().setKindMode(h.diagramId, "freehand");
    h.apply({
      flows: {
        set: [{ id: "recorded", name: "Recorded", mermaid: "", diagramId: h.diagramId, steps: {} }],
      },
    });
    const ctx = kindContextFor(h.diagram());
    expect(guidedKind.conforms(h.diagram(), ctx)).toEqual([]);
    const derived = guidedKind.derive!(h.diagram(), ctx);
    h.store.getState().setKindMode(h.diagramId, "kind", derived ?? undefined);
    expect(h.diagram().snapshot.flows.recorded?.name).toBe("Recorded");
  });
});

describe("a flow reference on the derived flow", () => {
  it("keep playing the updated sequence after an insert", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    h.rename(a, "Paga");
    // A flow is looked up by a diagram id and a flow id.
    const scene = { diagramId: h.diagramId, flowId: h.flow()!.id };
    const inserted = h.run("guided.next", [h.startId])!;
    h.rename(inserted, "Confirma");
    const played = h.store.getState().diagrams[scene.diagramId]!.snapshot.flows[scene.flowId]!;
    expect(played).toBeDefined();
    expect(h.sequence()).toEqual(["Start", "Confirma", "Paga"]);
    expect(Object.values(played.steps).map((s) => s.componentId)).toContain(inserted);
  });
});

describe("the step kind changes from the Journey tab", () => {
  const change = (
    h: ReturnType<typeof guidedHarness>,
    id: string,
    shape: "diamond" | "end" | "start" | "rectangle",
  ) => guidedChangeShape(h.diagram(), id, shape);

  it("turns a step into a decision, resized and arranged, in one undo step", () => {
    const h = guidedHarness();
    const step = h.run("guided.next", [h.startId])!;
    const outcome = change(h, step, "diamond");
    if ("refused" in outcome) throw new Error("refused");
    h.apply(outcome.edit);
    expect(isGuidedDecision(h.diagram().snapshot.components[step]!)).toBe(true);
    expect(h.absolute(step).width).toBe(180);
    expect(h.reading().laneOf.get(step)).toBe(h.laneIds[0]);
    h.store.getState().undo();
    expect(isGuidedDecision(h.diagram().snapshot.components[step]!)).toBe(false);
  });

  it("refuses an end that has exits, a second start, and removing the only start", () => {
    const h = guidedHarness();
    const step = h.run("guided.next", [h.startId])!;
    expect(change(h, h.startId, "end")).toEqual({
      refused: { key: "diagramKinds.guided.refused.endHasNoNext" },
    });
    expect(change(h, h.startId, "rectangle")).toEqual({
      refused: { key: "diagramKinds.guided.refused.keepStart" },
    });
    expect(change(h, step, "start")).toEqual({
      refused: { key: "diagramKinds.guided.refused.oneStart" },
    });
    // The last step has no exit: it may end the journey.
    expect("refused" in change(h, step, "end")).toBe(false);
  });
});
