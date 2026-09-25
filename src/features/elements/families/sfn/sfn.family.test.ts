import { describe, expect, it } from "vitest";
import type { Component, Diagram, Flow, FlowStep } from "@/features/diagram";
import { resolveVersionSnapshot } from "@/features/diagram";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { snapshotChecksum } from "@/features/collaboration/utils/snapshotChecksum";
import { buildComponentTypeCatalog, isValidNodeType } from "@/features/llm/component-catalog";
import { searchElements } from "@/features/llm/element-catalog-query";
import { paletteEntriesForCategory } from "@/features/elements/element.palette";
import { getElement, resolveElementCanvas } from "@/features/elements/element.registry";
import { canContain } from "@/features/elements/containment";
import { buildCategoryNavItems } from "@/features/canvas/toolbar/element-picker/buildCategoryNav";
import { buildFlowHighlight } from "@/features/canvas/flow/flowState";
import {
  compactContainerIdsOf,
  formatTargetPath,
  resolveVisibleTarget,
} from "@/features/canvas/flow/visibleTarget";
import { projectReadDiagram } from "@/features/canvas/core/projectReadDiagram";
import { emptyNodeBuildContext } from "@/features/elements/node-build-context.fixture";
import { stepsToMermaid } from "@/features/diagram/utils/flow-mermaid";
import { sfnElements } from "./sfn.family";

const IDS = sfnElements.map((element) => element.id);

const comp = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

describe("the Step Functions family", () => {
  it("is its own family, reaches the LLM catalog and has a picker tab", () => {
    const catalog = buildComponentTypeCatalog();
    expect(catalog).toContain("### Step Functions");
    for (const id of IDS) {
      expect(getElement(id)?.family, id).toBe("aws-sfn");
      expect(isValidNodeType(id), id).toBe(true);
      expect(catalog, id).toContain(`nodeType: "${id}"`);
      expect(id.startsWith("aws-"), id).toBe(false);
    }
    const tabs = buildCategoryNavItems((key) => key, {
      all: 0,
      c4: 0,
      canvas: 0,
      registry: 0,
      nodeTemplates: 0,
      flowchart: 0,
      byFamily: {},
    }).map((item) => item.id);
    expect(tabs).toContain("aws-sfn");
    // The machine, Parallel, Map, and one entry per state type.
    expect(paletteEntriesForCategory("aws-sfn")).toHaveLength(3 + 7);
    expect(searchElements({ query: "state machine" }).results.map((r) => r.elementType)).toContain(
      "sfn-state-machine",
    );
  });

  it("a machine, a Parallel and a Map take states; a state takes nothing", () => {
    for (const parent of ["sfn-state-machine", "sfn-parallel", "sfn-map"]) {
      for (const child of ["sfn-state", "sfn-parallel", "sfn-map"]) {
        expect(canContain(parent, child), `${parent} ⊃ ${child}`).toBe(true);
      }
      expect(canContain(parent, "system"), parent).toBe(false);
      expect(canContain(parent, "sfn-state-machine"), parent).toBe(false);
    }
    expect(canContain("sfn-state", "sfn-state")).toBe(false);
  });

  it("draws Choice, Succeed, Fail and the start with the flow node, the rest as cards", () => {
    const state = (stateType?: string) =>
      comp({ id: "s", name: "s", type: "sfn-state", ...(stateType ? { stateType } : {}) });
    for (const type of ["Choice", "Succeed", "Fail", "Start"]) {
      expect(resolveElementCanvas(state(type))?.rfType, type).toBe("sfn-flow-state");
    }
    for (const type of [undefined, "Task", "Wait", "Pass"]) {
      expect(resolveElementCanvas(state(type))?.rfType, String(type)).toBe("sfn-state");
    }
    const data = (stateType: string) =>
      resolveElementCanvas(state(stateType))!.buildData(state(stateType), emptyNodeBuildContext());
    expect(data("Choice")).toMatchObject({
      flowShape: "diamond",
      laneAccent: "hsl(var(--aws-integration))",
    });
    expect(data("Succeed")).toMatchObject({
      flowShape: "end",
      laneAccent: "hsl(var(--node-component))",
    });
    expect(data("Fail")).toMatchObject({ flowShape: "end", failed: true });
    expect(data("Start")).toMatchObject({ flowShape: "start", failed: false });
  });

  it("creates each state type at its size, writing its type only when it is not Task", () => {
    const element = getElement("sfn-state")!;
    const size = element.model.defaultSize as (o: object) => { width: number; height: number };
    expect(size({})).toEqual({ width: 220, height: 64 });
    expect(size({ sfnStateType: "Choice" })).toEqual({ width: 180, height: 112 });
    expect(size({ sfnStateType: "Fail" })).toEqual({ width: 56, height: 56 });
    const base = { id: "x", name: "x", description: "", parentId: null };
    expect(element.model.createComponent(base, {})).not.toHaveProperty("stateType");
    expect(element.model.createComponent(base, { sfnStateType: "Task" })).not.toHaveProperty(
      "stateType",
    );
    expect(element.model.createComponent(base, { sfnStateType: "Wait" })).toMatchObject({
      stateType: "Wait",
    });
  });

  it("badges a retrying Task, Parallel and Map; not a Wait", () => {
    const retry = [{ maxAttempts: 3, backoffRate: 2 }];
    const ctx = emptyNodeBuildContext();
    const task = comp({ id: "t", name: "t", type: "sfn-state", retry });
    const wait = comp({ id: "w", name: "w", type: "sfn-state", stateType: "Wait", retry });
    expect(getElement("sfn-state")!.canvas.buildData(task, ctx)).toMatchObject({
      retry: "retry 3× · backoff 2",
    });
    expect(getElement("sfn-state")!.canvas.buildData(wait, ctx)).toMatchObject({ retry: null });
    for (const type of ["sfn-parallel", "sfn-map"]) {
      const group = comp({ id: "g", name: "g", type, retry });
      expect(getElement(type)!.canvas.buildData(group, ctx), type).toMatchObject({
        retry: "retry 3× · backoff 2",
      });
    }
  });
});

// ─── Flow: Validar pedido → Tem estoque? → Cobrar cartão ─────────────────────

function diagram(compact: boolean): Diagram {
  const components = {
    api: comp({ id: "api", name: "Checkout", type: "container" }),
    sm: comp({
      id: "sm",
      name: "processar-pedido",
      type: "sfn-state-machine",
      ...(compact ? { collapsed: true } : {}),
    }),
    validate: comp({
      id: "validate",
      name: "Validar pedido",
      type: "sfn-state",
      parentId: "sm",
      service: "lambda",
      action: "Invoke",
    }),
    stock: comp({
      id: "stock",
      name: "Tem estoque?",
      type: "sfn-state",
      parentId: "sm",
      stateType: "Choice",
    }),
    charge: comp({
      id: "charge",
      name: "Cobrar cartão",
      type: "sfn-state",
      parentId: "sm",
      service: "lambda",
      action: "Invoke",
      retry: [{ maxAttempts: 3 }],
    }),
    out: comp({
      id: "out",
      name: "Sem estoque",
      type: "sfn-state",
      parentId: "sm",
      stateType: "Fail",
    }),
  };
  const flow = {
    id: "f",
    name: "Pedido",
    entryStepId: "s1",
    steps: {
      s1: { id: "s1", type: "action", componentId: "validate", next: "s2" },
      s2: { id: "s2", type: "action", componentId: "stock", next: "s3" },
      s3: { id: "s3", type: "action", componentId: "charge" },
    },
  } as unknown as Flow;
  return {
    id: "d",
    name: "Pedido",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components,
      connections: {
        start: { id: "start", sourceId: "api", targetId: "validate", label: "StartExecution" },
        c1: { id: "c1", sourceId: "validate", targetId: "stock", label: "" },
        yes: { id: "yes", sourceId: "stock", targetId: "charge", label: "sim" },
        no: { id: "no", sourceId: "stock", targetId: "out", label: "não" },
        caught: {
          id: "caught",
          sourceId: "charge",
          targetId: "out",
          label: "Catch · States.ALL",
          style: { edgeStyle: "catch" },
        },
      },
      flows: { f: flow },
      iconLibrary: {},
    },
    nodeLayouts: {
      api: { elementId: "api", x: -300, y: 100, width: 200, height: 80 },
      sm: { elementId: "sm", x: 0, y: 0, width: 760, height: 360 },
      validate: { elementId: "validate", x: 20, y: 120, width: 220, height: 64 },
      stock: { elementId: "stock", x: 280, y: 96, width: 180, height: 112 },
      charge: { elementId: "charge", x: 500, y: 60, width: 220, height: 64 },
      out: { elementId: "out", x: 560, y: 240, width: 56, height: 56 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

function readingAt(d: Diagram, stepId: string, history: string[]) {
  const { components } = resolveVersionSnapshot(d, null);
  return {
    badges: null,
    highlight: buildFlowHighlight(d.snapshot.flows.f, stepId, history, {
      components,
      compactIds: compactContainerIdsOf(components),
    }),
  };
}

describe("reading Validar pedido → Tem estoque? → Cobrar cartão", () => {
  it("expanded: each step lights its own state, and the catch edge is drawn", () => {
    const d = diagram(false);
    expect(readingAt(d, "s1", []).highlight.activeNodeId).toBe("validate");
    expect(readingAt(d, "s2", ["s1"]).highlight.activeNodeId).toBe("stock");
    const reading = readingAt(d, "s3", ["s1", "s2"]);
    expect(reading.highlight.activeNodeId).toBe("charge");
    const { edges } = projectReadDiagram(d, reading);
    expect(edges.find((e) => e.id === "caught")?.data).toMatchObject({ edgeStyle: "catch" });
    expect(edges.map((e) => e.id).sort()).toEqual(["c1", "caught", "no", "start", "yes"]);
  });

  it("compact: every step lights the machine and names the state by its path", () => {
    const d = diagram(true);
    const target = resolveVisibleTarget(d, "charge")!;
    expect(target.id).toBe("sm");
    expect(formatTargetPath(target.path)).toBe("processar-pedido › Cobrar cartão");
    for (const [step, history] of [
      ["s1", []],
      ["s2", ["s1"]],
      ["s3", ["s1", "s2"]],
    ] as const) {
      expect(readingAt(d, step, [...history]).highlight.activeNodeId, step).toBe("sm");
    }
    const { nodes, edges } = projectReadDiagram(d, readingAt(d, "s3", ["s1", "s2"]));
    expect(nodes.find((n) => n.id === "charge")?.hidden).toBe(true);
    expect(nodes.find((n) => n.id === "sm")?.style?.opacity).toBe(1);
    // The caller's edge lands on the machine; the ones between states are inside it.
    expect(edges.map((e) => e.id)).toEqual(["start"]);
    expect(edges[0]).toMatchObject({ source: "api", target: "sm" });
  });

  it("the machine counts its states, the Fail included", () => {
    const d = diagram(false);
    const data = getElement("sfn-state-machine")!.canvas.buildData(d.snapshot.components.sm, {
      ...emptyNodeBuildContext(),
      resolvedComponents: d.snapshot.components,
    });
    expect(data).toMatchObject({ stateCount: 4, workflowType: "Standard", xray: false });
  });

  it("mermaid names the states by their path in the machine", () => {
    const d = diagram(false);
    const text = stepsToMermaid(d.snapshot.flows.f, d.snapshot.components, d.snapshot.connections);
    expect(text).toContain("as processar-pedido › Tem estoque?");
  });

  it("render and export read the diagram and leave its checksum alone", () => {
    const d = diagram(true);
    const surface = () => ({ ...d.snapshot, nodeLayouts: d.nodeLayouts, edgeLayouts: {} });
    const before = snapshotChecksum(surface());
    const json = JSON.stringify(d);
    const components = d.snapshot.components;
    const ctx = {
      ...emptyNodeBuildContext(),
      resolvedComponents: components,
      resolvedNodeLayouts: d.nodeLayouts,
    };
    for (const component of Object.values(components)) {
      const canvas = resolveElementCanvas(component)!;
      canvas.buildData(component, ctx);
      canvas.buildStyle?.(component, ctx);
      getElement(component.type)!.export.drawio.toExportNode(
        component,
        { id: component.id, parentId: component.parentId, x: 0, y: 0, width: 200, height: 80 },
        { components, layouts: d.nodeLayouts },
      );
    }
    projectReadDiagram(d, readingAt(d, "s3", ["s1", "s2"]));
    expect(JSON.stringify(d)).toBe(json);
    expect(snapshotChecksum(surface())).toBe(before);
  });
});

describe("deleting the machine sews the flow", () => {
  it("app → validate → stock → charge → notify becomes app → notify, said once, and undoes", () => {
    const store = createTestDiagramStore();
    const created = store.getState().addDiagram("SFN", "container");
    store.getState().openDiagram(created.id);
    const s = store.getState();
    const app = s.addComponent("container", "Checkout", null, { x: -300, y: 0 });
    const sm = s.addComponent("sfn-state-machine", "processar-pedido", null, { x: 0, y: 0 });
    const validate = s.addComponent("sfn-state", "Validar pedido", sm.id);
    const stock = s.addComponent(
      "sfn-state",
      "Tem estoque?",
      sm.id,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        sfnStateType: "Choice",
      },
    );
    const charge = s.addComponent("sfn-state", "Cobrar cartão", sm.id);
    const notify = s.addComponent("container", "Notificador", null, { x: 900, y: 0 });
    const components = () => store.getState().diagrams[created.id].snapshot.components;
    expect(components()[stock.id]).toMatchObject({ parentId: sm.id, stateType: "Choice" });
    // Created at its type's size, not a Task's card (seen on the canvas).
    const layouts = store.getState().diagrams[created.id].nodeLayouts;
    expect(layouts[stock.id]).toMatchObject({ width: 180, height: 112 });
    expect(layouts[validate.id]).toMatchObject({ width: 220, height: 64 });
    expect(Object.keys(components()[validate.id]).sort()).toEqual(
      ["description", "id", "name", "parentId", "type"].sort(),
    );
    const steps = {
      s0: { id: "s0", type: "action", componentId: app.id, next: "s1" },
      s1: { id: "s1", type: "action", componentId: validate.id, next: "s2" },
      s2: { id: "s2", type: "action", componentId: stock.id, next: "s3" },
      s3: { id: "s3", type: "action", componentId: charge.id, next: "s4" },
      s4: { id: "s4", type: "action", componentId: notify.id },
    } as Record<string, FlowStep>;
    const flow = s.addFlow(created.id, "Pedido", "", steps)!;
    const walk = () => {
      const f = store.getState().diagrams[created.id].snapshot.flows[flow.id];
      const out: string[] = [];
      for (let id: string | undefined = f.entryStepId; id; id = f.steps[id].next) {
        out.push(f.steps[id].componentId!);
      }
      return out;
    };
    store.getState().removeComponent(sm.id);
    expect(walk()).toEqual([app.id, notify.id]);
    const notices = store.getState()._flowSewNotices!.notices;
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ flowName: "Pedido", elementName: "processar-pedido" });
    store.getState().undo();
    expect(walk()).toEqual([app.id, validate.id, stock.id, charge.id, notify.id]);
  });
});
