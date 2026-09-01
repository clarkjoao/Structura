import { current } from "immer";
import type { Diagram, Flow, FlowStep } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import { parseMermaidToSteps, stepsToMermaid } from "../../utils/flow-mermaid";
import {
  appendFlowStep,
  getFlowTail,
  insertFlowStep,
  isPlaceholderStep,
  type FlowCursor,
  type FlowEditRefusalCode,
  type FlowEditResult,
} from "../../utils/flow-edit";
import {
  appendFlowBranch,
  convertFlowStepToCondition,
  dropFlowBranch,
} from "../../utils/flow-condition";
import { moveStep, type MoveStepRefusalCode, type MoveStepTarget } from "../../utils/flow-move";
import { sewOnDelete, type SewBlockedStep } from "../../utils/flow-sew";
import type { AppState } from "../store.types";
import { resolveSceneSnapshot } from "../../utils/scene.utils";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory, pushHistoryCheckpoint } from "./history.slice";

export type FlowStoreRefusalCode = FlowEditRefusalCode | MoveStepRefusalCode | "unknown_flow";

export interface FlowStoreRefusal {
  ok: false;
  code: FlowStoreRefusalCode;
  detail: string;
}

export interface FlowStoreSuccess {
  ok: true;
  /** Id of the step the gesture created or filled in, when it made one. */
  stepId?: string;
  /** Steps the gesture dropped, e.g. the contents of a removed branch. */
  removedStepIds: string[];
  /** Removals that were held back rather than guessed at. */
  blocked: SewBlockedStep[];
}

/** One shape for every graph-editing action, so the panel handles refusals in one place. */
export type FlowStoreResult = FlowStoreSuccess | FlowStoreRefusal;

/**
 * One undo step per gesture — unless a session is open, in which case the
 * session's own checkpoint is the undo step and this adds nothing.
 */
function checkpoint(state: AppState, kind?: typeof STRUCTURAL_MUTATION_MARKER): void {
  if (state._flowSession) return;
  if (kind) pushHistory(state, kind);
  else pushHistory(state);
}

/**
 * `flow.mermaid` is a cache: every reader that draws or exports recomputes it
 * from the graph. Refreshing it wherever the graph changes keeps the stored
 * copy from drifting, now that the graph is written a step at a time instead
 * of once at the end of a recording.
 */
function refreshMermaid(d: Diagram, flow: Flow): void {
  const r = resolveSceneSnapshot(d, d.activeSceneId ?? null);
  flow.mermaid = stepsToMermaid(current(flow) as Flow, r.components, r.connections);
}

/** The one place a graph edit lands: checkpoint, write, refresh, touch. */
function applyGraph(
  state: AppState,
  d: Diagram,
  flow: Flow,
  next: { steps: Record<string, FlowStep>; entryStepId: string | undefined },
): void {
  checkpoint(state, STRUCTURAL_MUTATION_MARKER);
  flow.steps = next.steps;
  flow.entryStepId = next.entryStepId;
  refreshMermaid(d, flow);
  touchDiagram(d);
}

const UNKNOWN_FLOW = (flowId: string): FlowStoreRefusal => ({
  ok: false,
  code: "unknown_flow",
  detail: `flow "${flowId}" is not a flow of the active diagram`,
});

/** Content a recorded click carries; the id and the wiring belong to the graph. */
export type RecordedStepContent = Pick<
  FlowStep,
  "componentId" | "connectionId" | "handleId" | "description"
>;

export const flowsSlice = (set: (fn: (state: AppState) => void) => void, get: () => AppState) => ({
  addFlow: (
    diagramId: string,
    name: string,
    mermaid: string,
    precomputedSteps?: Record<string, FlowStep>,
  ): Flow | null => {
    const { diagrams } = get();
    const d = diagrams[diagramId];
    if (!d) {
      console.warn("[addFlow] Diagram not found:", diagramId);
      return null;
    }
    const activeId = get().activeDiagramId;
    const r = resolveSceneSnapshot(d, activeId === diagramId ? (d.activeSceneId ?? null) : null);

    let steps: Record<string, FlowStep>;
    let entryStepId: string | undefined;

    if (precomputedSteps && Object.keys(precomputedSteps).length > 0) {
      steps = precomputedSteps;
      const firstKey = Object.keys(steps)[0];
      entryStepId = firstKey;
    } else if (mermaid.trim()) {
      steps = parseMermaidToSteps(mermaid, r.components, r.connections);
      const inbound = new Set<string>();
      for (const s of Object.values(steps)) {
        if (s.next) inbound.add(s.next);
        s.branches?.forEach((b) => inbound.add(b.nextId));
      }
      const roots = Object.keys(steps).filter((id) => !inbound.has(id));
      entryStepId = roots[0] ?? Object.keys(steps)[0];
    } else {
      const stepId = generateId("step");
      steps = {
        [stepId]: { id: stepId, type: "action" },
      };
      entryStepId = stepId;
    }
    const flow: Flow = {
      id: generateId("flow"),
      name,
      mermaid,
      steps,
      diagramId,
      entryStepId,
    };
    set((state) => {
      // Re-check inside set to handle race condition if diagram was deleted
      const d = state.diagrams[diagramId];
      if (!d) {
        console.warn("[addFlow] Diagram not found inside set:", diagramId);
        return;
      }
      d.snapshot.flows[flow.id] = flow;
      touchDiagram(d);
    });
    return flow;
  },

  /**
   * Patches a flow — its name, its tags, or the graph itself.
   *
   * It takes a checkpoint like every other write to a flow. It was the one
   * that did not, so a script edit made through it, or a repair, left nothing
   * on the undo stack and Ctrl+Z reached past it to something older. Inside a
   * recording the session's own checkpoint is the undo unit and `checkpoint`
   * adds nothing, which is what keeps a recording of N steps to one undo.
   */
  updateFlow: (id: string, patch: Partial<Omit<Flow, "id">>) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const flow = d.snapshot.flows[id];
      if (!flow) return;
      checkpoint(state);
      Object.assign(flow, patch);
      if (patch.mermaid !== undefined && patch.steps === undefined) {
        const r = resolveSceneSnapshot(d, d.activeSceneId ?? null);
        flow.steps = parseMermaidToSteps(
          patch.mermaid ?? flow.mermaid,
          r.components,
          r.connections,
        );
      }
    });
  },

  removeFlow: (id: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      delete d.snapshot.flows[id];
    });
  },

  updateFlowStep: (flowId: string, stepId: string, patch: Partial<FlowStep>) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const flow = d.snapshot.flows[flowId];
      if (!flow || !flow.steps[stepId]) return;
      checkpoint(state);
      Object.assign(flow.steps[stepId], patch);
      touchDiagram(d);
    });
  },

  /**
   * Opens one undo checkpoint for a whole editing session — a recording, in
   * practice. While it is open the actions below push no checkpoints of their
   * own, so Ctrl+Z takes back the session rather than one click of it:
   * `MAX_HISTORY_STEPS` is 30, and a checkpoint per recorded step would push
   * the diagram's real history off the end after thirty clicks.
   */
  beginFlowSession: () => {
    set((state) => {
      const recorded = pushHistoryCheckpoint(state);
      state._flowSession = { undoMark: recorded ? state.past.length : null };
    });
  },

  /** Keeps what the session wrote; its checkpoint stays as the one undo step. */
  commitFlowSession: () => {
    set((state) => {
      state._flowSession = null;
    });
  },

  /**
   * Throws the session away: the diagram goes back to the snapshot the session
   * opened on, and the checkpoint goes with it, so a cancelled recording
   * leaves neither a half-written flow nor a Ctrl+Z that does nothing visible.
   */
  cancelFlowSession: () => {
    set((state) => {
      const session = state._flowSession;
      state._flowSession = null;
      if (!session || session.undoMark === null) return;
      if (state.past.length !== session.undoMark) return;
      const entry = state.past.pop();
      if (!entry) return;
      const d = state.diagrams[entry.diagramId];
      if (!d) return;
      d.snapshot = entry.snapshot;
      d.nodeLayouts = entry.nodeLayouts;
      d.edgeLayouts = entry.edgeLayouts;
      touchDiagram(d);
    });
  },

  /**
   * Writes one recorded step into the flow, at the end of the sequence the
   * cursor points at. A step the recorder is still holding open — a brand new
   * flow's first step, a fresh branch's placeholder — is filled in rather than
   * pushed further down, so quick entry does not leave empty rows behind.
   */
  recordFlowStep: (
    flowId: string,
    content: RecordedStepContent,
    cursor: FlowCursor,
  ): FlowStoreResult => {
    let outcome: FlowStoreResult = UNKNOWN_FLOW(flowId);
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const draft = d.snapshot.flows[flowId];
      if (!draft) return;
      const flow = current(draft) as Flow;

      const tailId = getFlowTail(flow, cursor);
      const tail = tailId ? flow.steps[tailId] : undefined;
      if (tail && isPlaceholderStep(tail)) {
        outcome = { ok: true, stepId: tail.id, removedStepIds: [], blocked: [] };
        checkpoint(state, STRUCTURAL_MUTATION_MARKER);
        Object.assign(draft.steps[tail.id], content);
        refreshMermaid(d, draft);
        touchDiagram(d);
        return;
      }

      const step: FlowStep = { id: generateId("step"), type: "action", ...content };
      const result = appendFlowStep(flow, step, cursor);
      outcome = toStoreResult(result, step.id);
      if (!result.ok) return;
      applyGraph(state, d, draft, result);
    });
    return outcome;
  },

  /**
   * Takes back the last recorded step of the sequence the cursor points at.
   *
   * The head of a sequence is emptied rather than removed — the flow keeps its
   * first step and a condition keeps its branch, both back in the state the
   * recorder holds them open in. Anything further along is removed and the
   * graph sewn shut behind it.
   */
  undoLastRecordedStep: (flowId: string, cursor: FlowCursor): FlowStoreResult => {
    let outcome: FlowStoreResult = UNKNOWN_FLOW(flowId);
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const draft = d.snapshot.flows[flowId];
      if (!draft) return;
      const flow = current(draft) as Flow;

      const tailId = getFlowTail(flow, cursor);
      if (!tailId) {
        outcome = { ok: true, removedStepIds: [], blocked: [] };
        return;
      }

      const headId =
        cursor.kind === "trunk"
          ? flow.entryStepId
          : flow.steps[cursor.conditionStepId]?.branches?.[cursor.branchIndex]?.nextId;

      if (tailId === headId) {
        outcome = { ok: true, stepId: tailId, removedStepIds: [], blocked: [] };
        if (isPlaceholderStep(flow.steps[tailId]!)) return;
        checkpoint(state, STRUCTURAL_MUTATION_MARKER);
        const emptied = draft.steps[tailId]!;
        delete emptied.componentId;
        delete emptied.connectionId;
        delete emptied.handleId;
        delete emptied.description;
        refreshMermaid(d, draft);
        touchDiagram(d);
        return;
      }

      const result = sewOnDelete(flow, [tailId]);
      outcome = { ok: true, removedStepIds: result.removedStepIds, blocked: result.blocked };
      if (result.removedStepIds.length === 0) return;
      applyGraph(state, d, draft, result);
    });
    return outcome;
  },

  /** Adds an empty step at an explicit place in the script. */
  insertFlowStepAt: (flowId: string, target: MoveStepTarget): FlowStoreResult => {
    let outcome: FlowStoreResult = UNKNOWN_FLOW(flowId);
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const draft = d.snapshot.flows[flowId];
      if (!draft) return;
      const flow = current(draft) as Flow;
      const step: FlowStep = { id: generateId("step"), type: "action" };
      const result = insertFlowStep(flow, step, target);
      outcome = toStoreResult(result, step.id);
      if (!result.ok) return;
      applyGraph(state, d, draft, result);
    });
    return outcome;
  },

  /** Relinks the graph so `stepId` sits at `target`. Refuses rather than guessing. */
  moveFlowStep: (flowId: string, stepId: string, target: MoveStepTarget): FlowStoreResult => {
    let outcome: FlowStoreResult = UNKNOWN_FLOW(flowId);
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const draft = d.snapshot.flows[flowId];
      if (!draft) return;
      const flow = current(draft) as Flow;
      const result = moveStep(flow, stepId, target);
      outcome = result.ok
        ? { ok: true, removedStepIds: [], blocked: [] }
        : { ok: false, code: result.code, detail: result.detail };
      if (!result.ok) return;
      applyGraph(state, d, draft, result);
    });
    return outcome;
  },

  /** Removes steps and sews the graph shut behind them. */
  removeFlowSteps: (flowId: string, stepIds: readonly string[]): FlowStoreResult => {
    let outcome: FlowStoreResult = UNKNOWN_FLOW(flowId);
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const draft = d.snapshot.flows[flowId];
      if (!draft) return;
      const flow = current(draft) as Flow;
      const result = sewOnDelete(flow, stepIds);
      outcome = {
        ok: true,
        removedStepIds: result.removedStepIds,
        blocked: result.blocked,
      };
      if (result.removedStepIds.length === 0) return;
      applyGraph(state, d, draft, result);
    });
    return outcome;
  },

  convertStepToCondition: (
    flowId: string,
    stepId: string,
    conditionLabel: string,
    branchLabels: readonly string[],
  ): FlowStoreResult => {
    let outcome: FlowStoreResult = UNKNOWN_FLOW(flowId);
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const draft = d.snapshot.flows[flowId];
      if (!draft) return;
      const flow = current(draft) as Flow;
      const result = convertFlowStepToCondition(
        flow,
        stepId,
        conditionLabel,
        branchLabels.map((label) => ({ label, stepId: generateId("step") })),
      );
      outcome = toStoreResult(result, stepId);
      if (!result.ok) return;
      applyGraph(state, d, draft, result);
    });
    return outcome;
  },

  addFlowBranch: (flowId: string, conditionStepId: string, label: string): FlowStoreResult => {
    let outcome: FlowStoreResult = UNKNOWN_FLOW(flowId);
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const draft = d.snapshot.flows[flowId];
      if (!draft) return;
      const flow = current(draft) as Flow;
      const newStepId = generateId("step");
      const result = appendFlowBranch(flow, conditionStepId, label, newStepId);
      outcome = toStoreResult(result, newStepId);
      if (!result.ok) return;
      applyGraph(state, d, draft, result);
    });
    return outcome;
  },

  removeFlowBranch: (
    flowId: string,
    conditionStepId: string,
    branchIndex: number,
  ): FlowStoreResult => {
    let outcome: FlowStoreResult = UNKNOWN_FLOW(flowId);
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const draft = d.snapshot.flows[flowId];
      if (!draft) return;
      const flow = current(draft) as Flow;
      const result = dropFlowBranch(flow, conditionStepId, branchIndex);
      outcome = toStoreResult(result);
      if (!result.ok) return;
      applyGraph(state, d, draft, result);
    });
    return outcome;
  },

  /** Renames one branch of a condition; the wiring is untouched. */
  setFlowBranchLabel: (
    flowId: string,
    conditionStepId: string,
    branchIndex: number,
    label: string,
  ) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const flow = d.snapshot.flows[flowId];
      const branch = flow?.steps[conditionStepId]?.branches?.[branchIndex];
      if (!branch) return;
      checkpoint(state);
      branch.label = label;
      touchDiagram(d);
    });
  },
});

function toStoreResult(result: FlowEditResult, stepId?: string): FlowStoreResult {
  if (!result.ok) return { ok: false, code: result.code, detail: result.detail };
  return { ok: true, stepId, removedStepIds: result.removedStepIds, blocked: [] };
}
