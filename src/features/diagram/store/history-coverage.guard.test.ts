import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/features/elements/bootstrap";
import { ExternalLinkType } from "../enums";
import type { Diagram } from "../model/diagram.types";
import { HISTORY_COALESCE_MS } from "./store.constants";
import { createTestDiagramStore } from "./test-utils";

/**
 * Guard: every structural store action writes undo history.
 *
 * Every past regression here was "an action forgot pushHistory":
 *  - 38ed79ea: removeService, removeVersion (was removeScene), addComponentToVersion,
 *    addConnectionToVersion, removeIconReferences (pushed before its null-check),
 *    convertStepToCondition.
 *  - fbff9f70: updateFlow, and creating / deleting a flow were not on the undo stack.
 *  - 414aaf95: duplicating a version cloned an immer draft and threw.
 *
 * Each row below runs one action on a minimal diagram, asserts the undo stack grew by
 * exactly one entry, then undoes and asserts the diagram is what it was before.
 * A meta test makes a NEW store action fail until it is classified in MUST_PUSH or EXEMPT.
 */

type Store = ReturnType<typeof createTestDiagramStore>;

interface Fixture {
  store: Store;
  diagramId: string;
}

/** What undo restores: the checkpointed fields of the diagram. */
function undoable(d: Diagram) {
  return {
    snapshot: d.snapshot,
    nodeLayouts: d.nodeLayouts,
    edgeLayouts: d.edgeLayouts,
    versions: d.versions,
  };
}

function diagramOf(f: Fixture): Diagram {
  const d = f.store.getState().diagrams[f.diagramId];
  if (!d) throw new Error("diagram is gone");
  return d;
}

function comp(f: Fixture, name: string, x = 0): string {
  return f.store.getState().addComponent("system", name, null, { x, y: 0 }).id;
}

function connect(f: Fixture, a: string, b: string): string {
  const c = f.store.getState().addConnection(a, b, "calls");
  if (!c) throw new Error("addConnection refused");
  return c.id;
}

function flowWithStep(f: Fixture): { flowId: string; stepId: string } {
  const flow = f.store.getState().addFlow(f.diagramId, "Checkout", "");
  if (!flow) throw new Error("addFlow returned null");
  const step = f.store.getState().recordFlowStep(flow.id, { componentId: "n1" }, { kind: "trunk" });
  if (!step.ok || !step.stepId) throw new Error("recordFlowStep refused");
  return { flowId: flow.id, stepId: step.stepId };
}

interface Row {
  /** Prepares the diagram and returns the one action under test. */
  setup: (f: Fixture) => () => void;
}

/** Actions that must leave exactly one undo checkpoint. */
const MUST_PUSH: Record<string, Row> = {
  // 38ed79ea-era components/connections, plus the AGENTS.md rule itself.
  addComponent: { setup: (f) => () => void comp(f, "A") },
  updateComponent: {
    setup: (f) => {
      const id = comp(f, "A");
      return () => f.store.getState().updateComponent(id, { name: "B" });
    },
  },
  removeComponent: {
    setup: (f) => {
      const id = comp(f, "A");
      return () => f.store.getState().removeComponent(id);
    },
  },
  addConnection: {
    setup: (f) => {
      const a = comp(f, "A");
      const b = comp(f, "B", 200);
      return () => void f.store.getState().addConnection(a, b, "calls");
    },
  },
  updateConnection: {
    setup: (f) => {
      const id = connect(f, comp(f, "A"), comp(f, "B", 200));
      return () => f.store.getState().updateConnection(id, { label: "renamed" });
    },
  },
  removeConnection: {
    setup: (f) => {
      const id = connect(f, comp(f, "A"), comp(f, "B", 200));
      return () => f.store.getState().removeConnection(id);
    },
  },
  swapConnectionDirection: {
    setup: (f) => {
      const id = connect(f, comp(f, "A"), comp(f, "B", 200));
      return () => void f.store.getState().swapConnectionDirection(id);
    },
  },
  removeElements: {
    setup: (f) => {
      const a = comp(f, "A");
      const b = comp(f, "B", 200);
      const e = connect(f, a, b);
      return () => f.store.getState().removeElements([a], [e]);
    },
  },
  groupNodes: {
    setup: (f) => {
      const a = comp(f, "A");
      const b = comp(f, "B", 200);
      return () => void f.store.getState().groupNodes([a, b]);
    },
  },
  addExternalLink: {
    setup: (f) => {
      const id = comp(f, "A");
      return () =>
        f.store
          .getState()
          .addExternalLink(id, {
            label: "docs",
            url: "https://example.com",
            type: ExternalLinkType.Generic,
          });
    },
  },
  // 38ed79ea: removeService forgot pushHistory. Undo puts the components' serviceId back.
  removeService: {
    setup: (f) => {
      const id = comp(f, "A");
      const svc = f.store.getState().addService({
        name: "Billing",
        description: "",
        repositoryUrl: "",
        technology: [],
      });
      f.store.getState().linkComponentToService(id, svc.id);
      return () => f.store.getState().removeService(svc.id);
    },
  },
  linkComponentToService: {
    setup: (f) => {
      const id = comp(f, "A");
      const svc = f.store.getState().addService({
        name: "Billing",
        description: "",
        repositoryUrl: "",
        technology: [],
      });
      return () => f.store.getState().linkComponentToService(id, svc.id);
    },
  },
  // 38ed79ea: removeIconReferences pushed history before its null-check; it must push
  // exactly once when it has work to do on the active diagram.
  removeIconReferences: {
    setup: (f) => {
      const id = comp(f, "A");
      f.store.getState().updateComponent(id, { customIconId: "icon-1" });
      return () => {
        // The slice is merged into the store but absent from the typed action surface.
        const state = f.store.getState();
        if (!("removeIconReferences" in state)) throw new Error("removeIconReferences missing");
        const remove: unknown = state.removeIconReferences;
        if (typeof remove !== "function") throw new Error("removeIconReferences missing");
        remove(f.diagramId, "icon-1");
      };
    },
  },
  // Versions (formerly scenes): 38ed79ea removeScene/addComponentToScene/addConnectionToScene.
  addVersion: { setup: (f) => () => void f.store.getState().addVersion("Proposal") },
  removeVersion: {
    setup: (f) => {
      const v = f.store.getState().addVersion("Proposal");
      return () => f.store.getState().removeVersion(v.id);
    },
  },
  // 414aaf95: duplicating a version cloned an immer draft and threw.
  duplicateVersion: {
    setup: (f) => {
      const v = f.store.getState().addVersion("Proposal");
      f.store.getState().setActiveVersion(v.id);
      comp(f, "Own");
      f.store.getState().setActiveVersion(null);
      return () => void f.store.getState().duplicateVersion(v.id, "Copy");
    },
  },
  addComponentToVersion: {
    setup: (f) => {
      const v = f.store.getState().addVersion("Proposal");
      const base = comp(f, "A");
      const source = diagramOf(f).snapshot.components[base];
      if (!source) throw new Error("component missing");
      return () =>
        f.store
          .getState()
          .addComponentToVersion(
            v.id,
            { ...source, id: "added-1", name: "Added" },
            { elementId: "added-1", x: 10, y: 10 },
          );
    },
  },
  addConnectionToVersion: {
    setup: (f) => {
      const v = f.store.getState().addVersion("Proposal");
      const a = comp(f, "A");
      const b = comp(f, "B", 200);
      return () =>
        f.store.getState().addConnectionToVersion(v.id, {
          id: "added-conn",
          sourceId: a,
          targetId: b,
          label: "calls",
        });
    },
  },
  removeComponentFromVersion: {
    setup: (f) => {
      const v = f.store.getState().addVersion("Proposal");
      f.store.getState().setActiveVersion(v.id);
      const own = comp(f, "Own");
      f.store.getState().setActiveVersion(null);
      return () => f.store.getState().removeComponentFromVersion(v.id, own);
    },
  },
  removeConnectionFromVersion: {
    setup: (f) => {
      const a = comp(f, "A");
      const b = comp(f, "B", 200);
      const e = connect(f, a, b);
      const v = f.store.getState().addVersion("Proposal");
      return () => f.store.getState().removeConnectionFromVersion(v.id, e);
    },
  },
  // fbff9f70: creating, editing and deleting a flow were not on the undo stack.
  addFlow: { setup: (f) => () => void f.store.getState().addFlow(f.diagramId, "Checkout", "") },
  updateFlow: {
    setup: (f) => {
      const flow = f.store.getState().addFlow(f.diagramId, "Checkout", "");
      if (!flow) throw new Error("addFlow returned null");
      return () => f.store.getState().updateFlow(flow.id, { name: "Renamed" });
    },
  },
  // The brief calls this deleteFlow; the real action is removeFlow.
  removeFlow: {
    setup: (f) => {
      const flow = f.store.getState().addFlow(f.diagramId, "Checkout", "");
      if (!flow) throw new Error("addFlow returned null");
      return () => f.store.getState().removeFlow(flow.id);
    },
  },
  // 38ed79ea: convertStepToCondition forgot pushHistory.
  convertStepToCondition: {
    setup: (f) => {
      const { flowId, stepId } = flowWithStep(f);
      return () =>
        void f.store.getState().convertStepToCondition(flowId, stepId, "ok?", ["y", "n"]);
    },
  },
  recordFlowStep: {
    setup: (f) => {
      const flow = f.store.getState().addFlow(f.diagramId, "Checkout", "");
      if (!flow) throw new Error("addFlow returned null");
      return () =>
        void f.store.getState().recordFlowStep(flow.id, { componentId: "n1" }, { kind: "trunk" });
    },
  },
};

/**
 * Real gaps found by this guard: the action should checkpoint but does not (current code).
 * Their rows run as `it.fails`, so fixing the action turns the row red until it is removed here.
 */
const KNOWN_GAPS = new Set(["addVersion", "duplicateVersion"]);

/**
 * Actions that deliberately leave no checkpoint of their own. `reason` is the contract:
 * anything not in MUST_PUSH must be justified here.
 */
const EXEMPT: Record<string, string> = {
  // History itself.
  undo: "history",
  redo: "history",
  pushHistoryBoundary: "is the explicit checkpoint opener",
  // AGENTS.md: deliberately NOT checkpointed (drag/resize fire continuously; commit goes through batchCommitNodeDrag).
  updateNodeLayout: "high-frequency layout write, asserted not to push below",
  batchUpdateNodeLayouts: "high-frequency layout write, asserted not to push below",
  updateViewport: "viewport is not content",
  // Not diagram content, or not part of the diagram's undo snapshot.
  addDiagram: "workspace-level, not in a diagram snapshot",
  addImportedDiagram: "workspace-level",
  importDiagram: "workspace-level",
  duplicateDiagram: "workspace-level",
  openDiagram: "navigation",
  updateDiagram: "diagram metadata, not snapshot",
  updateDiagramDescription: "diagram metadata, not snapshot",
  setTextsVisible: "view preference",
  setShowLegend: "view preference",
  deleteDiagram: "workspace-level",
  addFolder: "workspace folders",
  renameFolder: "workspace folders",
  deleteFolder: "workspace folders",
  moveDiagram: "workspace folders",
  addService: "global service registry; removal/linking is what edits diagrams",
  updateService: "global registry edit; sync into diagrams is derived",
  saveUserTemplate: "user template library",
  updateUserTemplate: "user template library",
  deleteUserTemplate: "user template library",
  addIcon: "global icon store",
  removeIcon: "global icon store; references go through removeIconReferences",
  updateIconName: "global icon store",
  incrementIconUsage: "global icon store",
  decrementIconUsage: "global icon store",
  copyToClipboard: "clipboard only",
  clearClipboard: "clipboard only",
  hydrateClipboard: "clipboard only",
  // Version selection is view state.
  setActiveVersion: "view state",
  setCompareVersion: "view state",
  setActiveVersionByKey: "view state",
  carryActiveVersionKey: "view state",
  beginFlowSession: "opens a session whose own checkpoint is the undo step",
  commitFlowSession: "closes a session",
  cancelFlowSession: "closes a session",
  // Structural actions that DO push but are exercised by their own focused tests.
  addComponentConnectedFrom: "pushes; covered in add-component-connected-from.test.ts",
  addSharedRef: "pushes; covered in shared-ref.test.ts",
  routeConnectionThroughRef: "pushes; covered in shared-ref.test.ts",
  batchUpdateComponents: "pushes; covered in batch-update-components.test.ts",
  updateHandleOrder: "pushes unless version-owned; covered in components tests",
  updateExternalLink: "pushes unless version-owned; same code path as addExternalLink",
  removeExternalLink: "pushes unless version-owned; same code path as addExternalLink",
  linkComponentToDiagram: "pushes; same code path as linkComponentToService",
  batchCommitNodeDrag: "pushes; covered in drag-commit-history.test.ts",
  setParent: "pushes; covered in component-parenting.slice.test.ts",
  ungroupNodes: "pushes; covered in component-parenting.slice.test.ts",
  setEdgeControlPoints:
    "pushes unless options.history=false; covered in edge-control-points.test.ts",
  addEdgeControlPoint: "pushes; covered in edge-control-points.test.ts",
  removeEdgeControlPoint: "pushes; covered in edge-control-points.test.ts",
  resetEdgeControlPoints: "pushes; covered in edge-control-points.test.ts",
  setEdgeLabelOffset: "pushes unless options.history=false; covered in edge-control-points.test.ts",
  applyLayoutEdges: "pushes; covered in applyLayoutEdges.test.ts",
  alignNodes: "pushes via applyBoxMoves; covered in layout.slice.test.ts",
  distributeNodes: "pushes via applyBoxMoves; covered in layout.slice.test.ts",
  fitGroupToChildren: "pushes; covered in layout.slice.test.ts",
  applyAutoLayout: "pushes; covered in layout.slice.autolayout.test.ts",
  setLayoutSettings: "pushes; covered in layout.slice.layoutSettings.test.ts",
  // Possible gap, flagged in the report: z-order writes layout without a checkpoint.
  bringToFront: "z-order is a layout write with no checkpoint today (possible gap)",
  sendToBack: "z-order is a layout write with no checkpoint today (possible gap)",
  setNodeZIndex: "z-order is a layout write with no checkpoint today (possible gap)",
  updateFlowStep:
    "step edit routed through flows.slice checkpoint(); covered in flows.history.test.ts",
  insertFlowStepAt: "flows checkpoint(); covered in flows.slice.test.ts",
  moveFlowStep: "flows checkpoint(); covered in flows.slice.test.ts",
  removeFlowSteps: "flows checkpoint(); covered in flows.slice.test.ts",
  addFlowBranch: "flows checkpoint(); covered in flows.slice.test.ts",
  removeFlowBranch: "flows checkpoint(); covered in flows.slice.test.ts",
  setFlowBranchLabel: "flows checkpoint(); covered in flows.slice.test.ts",
  recordFlowCondition: "flows checkpoint(); covered in flows.slice.test.ts",
  undoLastRecordedStep: "flows checkpoint(); covered in flows.slice.test.ts",
  insertPattern: "pushes; covered in patterns.slice.test.ts",
  insertGeneratedGraph: "pushes; covered in generated-graph.slice.test.ts",
  applyGraphChanges: "pushes; covered in generated-graph.slice.test.ts",
  applyKindEdit: "pushes unless options.history=false; covered in kind.slice.test.ts",
  setKindMode: "pushes; covered in kind.slice.test.ts",
  pasteFromClipboard: "pushes; covered in clipboard.slice.paste.test.ts",
  importDrawioResult: "pushes; import path",
  importMermaidSequenceResult: "pushes; import path",
  mergeVersionIntoBase: "pushes; covered in versions.slice.test.ts",
  setVersionStatus: "version metadata; covered in versions.slice.test.ts",
  removeVersionByKey: "delegates to removeVersion",
  keepVersionCopy: "pushes; covered in version-sew.test.ts",
  takeBaseVersion: "pushes; covered in version-sew.test.ts",
  renameVersion: "version metadata; covered in versions.slice.test.ts",
  updateVersionNodeLayout: "high-frequency layout write inside a version",
};

/** Deliberately excluded from history: AGENTS.md says these must NOT push. */
const NEVER_PUSH: Record<string, (f: Fixture) => () => void> = {
  updateNodeLayout: (f) => {
    const id = comp(f, "A");
    return () => f.store.getState().updateNodeLayout(id, { x: 50, y: 60 });
  },
  batchUpdateNodeLayouts: (f) => {
    const id = comp(f, "A");
    return () =>
      f.store.getState().batchUpdateNodeLayouts([{ elementId: id, position: { x: 50, y: 60 } }]);
  },
};

function fixture(): Fixture {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Guard", "context");
  store.getState().openDiagram(diagram.id);
  return { store, diagramId: diagram.id };
}

describe("every structural action writes undo history", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const runRow = (name: string) => {
    const f = fixture();
    const act = MUST_PUSH[name]!.setup(f);
    // Soft checkpoints fold into the previous one inside the coalescing window; make the action its own gesture.
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
    const pastBefore = f.store.getState().past.length;
    const before = structuredClone(undoable(diagramOf(f)));

    act();

    expect(f.store.getState().past.length).toBe(pastBefore + 1);

    f.store.getState().undo();

    expect(undoable(diagramOf(f))).toEqual(before);
  };

  for (const name of Object.keys(MUST_PUSH)) {
    const title = `${name} adds one undo step and undo restores the diagram`;
    // BUG (current code): addVersion and duplicateVersion in versions.slice.ts never call
    // pushHistory, so creating or duplicating a version cannot be undone.
    if (KNOWN_GAPS.has(name)) it.fails(title, () => runRow(name));
    else it(title, () => runRow(name));
  }

  // 414aaf95: duplicating a version that holds components cloned an immer draft and threw.
  it("duplicateVersion of a version holding components copies it without throwing", () => {
    const f = fixture();
    MUST_PUSH.duplicateVersion!.setup(f)();
    expect(Object.keys(diagramOf(f).versions ?? {})).toHaveLength(2);
  });

  it.each(Object.keys(NEVER_PUSH))("%s deliberately does not write history", (name) => {
    const f = fixture();
    const act = NEVER_PUSH[name]!(f);
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
    const pastBefore = f.store.getState().past.length;

    act();

    expect(f.store.getState().past.length).toBe(pastBefore);
  });

  it("classifies every store action as must-push or exempt", () => {
    const state: Record<string, unknown> = { ...createTestDiagramStore().getState() };
    const actions = Object.keys(state).filter((k) => typeof state[k] === "function");
    const unclassified = actions.filter((k) => !(k in MUST_PUSH) && !(k in EXEMPT));
    expect(
      unclassified,
      `New store action(s) ${unclassified.join(", ")}: add to MUST_PUSH (with a row) or EXEMPT (with a reason) in history-coverage.guard.test.ts`,
    ).toEqual([]);
    const stale = [...Object.keys(MUST_PUSH), ...Object.keys(EXEMPT)].filter(
      (k) => !actions.includes(k),
    );
    expect(stale, `Classified but no longer a store action: ${stale.join(", ")}`).toEqual([]);
    const both = Object.keys(MUST_PUSH).filter((k) => k in EXEMPT);
    expect(both).toEqual([]);
  });
});
