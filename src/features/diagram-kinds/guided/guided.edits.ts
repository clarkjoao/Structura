import type { FlowNodeShape } from "@/features/diagram/model/component.types";
import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindEdit, KindNodeInput } from "@/features/diagram/model/kind-edit.types";
import type { JsonObject, JsonValue } from "@/features/diagram/model/diagram-kind";
import { PanelKind } from "@/features/diagram/enums";
import {
  COMPONENT_TYPE_PANEL,
  COMPONENT_TYPE_PROCESS_NODE,
} from "@/features/diagram/model/component-type-constants";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import type { KindCommandOutcome, KindContext, KindText } from "../kind.types";
import {
  GUIDED_LANE_ORDER_KEY,
  type GuidedReading,
  isGuidedDecision,
  isGuidedEnd,
  neighbourLane,
  readGuided,
} from "./guided.model";
import {
  COLUMN_GAP,
  LANE_HEADER,
  LANE_INSET,
  LANE_MIN_DEPTH,
  LANE_MIN_LENGTH,
  STACK_GAP,
  laneColor,
  stepSize,
} from "./guided.geometry";

/**
 * The guided gestures as change sets (spec guided-flow-authoring). Each one
 * also places what it adds provisionally — one column after its predecessor,
 * in its lane — so the step shows in place at once; the guided arrangement
 * refines it right after.
 */

export type GuidedOutcome = KindCommandOutcome | { refused: KindText };

const refused = (code: string): { refused: KindText } => ({
  refused: { key: `diagramKinds.guided.refused.${code}` },
});

const NEW_STEP = "new-step";
const NEW_DECISION = "new-decision";

function newStepInput(
  ctx: KindContext,
  key: string,
  laneId: string,
  shape: FlowNodeShape,
  at: { x: number; y: number },
): KindNodeInput {
  const size = stepSize(shape);
  return {
    key,
    type: COMPONENT_TYPE_PROCESS_NODE,
    flowShape: shape,
    name:
      shape === "diamond"
        ? ctx.t("diagramKinds.guided.newDecision")
        : shape === "end"
          ? ctx.t("diagramKinds.guided.endName")
          : ctx.t("diagramKinds.guided.newStep"),
    parent: laneId,
    x: at.x,
    y: at.y,
    width: size.width,
    height: size.height,
  };
}

/** Where a step goes provisionally: one column after `afterId`, in `laneId`. */
function provisionalPosition(
  diagram: DiagramModel,
  reading: GuidedReading,
  afterId: string,
  laneId: string,
  shape: FlowNodeShape,
  slot = 0,
): { x: number; y: number } {
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const vertical = diagram.direction === "TB";
  const after = nodeLayouts[afterId];
  const afterLane = reading.laneOf.get(afterId);
  const lane = nodeLayouts[laneId];
  const afterLaneLayout = afterLane ? nodeLayouts[afterLane] : undefined;
  const size = stepSize(shape);
  const base = after ?? { x: LANE_HEADER + LANE_INSET, y: LANE_INSET, width: 0, height: 0 };
  const afterWidth = after?.width ?? 0;
  const afterHeight = after?.height ?? 0;
  // Along the axis, in absolute terms, then back to the target lane's frame.
  const alongAbs = vertical
    ? (afterLaneLayout?.y ?? 0) + base.y + afterHeight + COLUMN_GAP
    : (afterLaneLayout?.x ?? 0) + base.x + afterWidth + COLUMN_GAP;
  const laneDepth = vertical ? (lane?.width ?? LANE_MIN_DEPTH) : (lane?.height ?? LANE_MIN_DEPTH);
  const across =
    laneDepth / 2 -
    (vertical ? size.width : size.height) / 2 +
    slot * ((vertical ? size.width : size.height) + STACK_GAP);
  return vertical
    ? { x: across, y: alongAbs - (lane?.y ?? 0) }
    : { x: alongAbs - (lane?.x ?? 0), y: across };
}

function singleSelectedStep(diagram: DiagramModel, selectedIds: readonly string[]) {
  if (selectedIds.length !== 1) return null;
  const reading = readGuided(diagram);
  const step = reading.steps.get(selectedIds[0]!);
  return step ? { reading, step } : null;
}

/** Tab: the next step after the selected one — appended, inserted, or a decision's new exit. */
export function guidedAddNext(
  diagram: DiagramModel,
  selectedIds: readonly string[],
  ctx: KindContext,
): GuidedOutcome {
  const found = singleSelectedStep(diagram, selectedIds);
  if (!found) return refused("selectOneStep");
  const { reading, step } = found;
  if (isGuidedDecision(step)) return guidedAddExit(diagram, reading, step.id, ctx);
  if (isGuidedEnd(step)) return refused("endHasNoNext");
  const laneId = reading.laneOf.get(step.id)!;
  const exits = reading.outgoing.get(step.id) ?? [];
  const at = provisionalPosition(diagram, reading, step.id, laneId, "rectangle");
  const add = [newStepInput(ctx, NEW_STEP, laneId, "rectangle", at)];
  if (exits.length === 1) {
    // Insert between: the existing connection now ends on the new step, which continues to the old successor.
    const exit = exits[0]!;
    return {
      edit: {
        add,
        reconnect: [{ id: exit.id, target: NEW_STEP }],
        connect: [{ source: NEW_STEP, target: exit.targetId }],
        move: shiftAfter(diagram, reading, exit.targetId),
      },
      select: NEW_STEP,
      editLabel: true,
    };
  }
  return {
    edit: { add, connect: [{ source: step.id, target: NEW_STEP }] },
    select: NEW_STEP,
    editLabel: true,
  };
}

/** Pushes `fromId` (and nothing else) one column along, so an insert does not land on it. */
function shiftAfter(
  diagram: DiagramModel,
  reading: GuidedReading,
  fromId: string,
): KindEdit["move"] {
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const layout = nodeLayouts[fromId];
  const step = reading.steps.get(fromId);
  if (!layout || !step) return [];
  const delta = stepSize("rectangle").width + COLUMN_GAP;
  return diagram.direction === "TB"
    ? [{ id: fromId, x: layout.x, y: layout.y + delta }]
    : [{ id: fromId, x: layout.x + delta, y: layout.y }];
}

function guidedAddExit(
  diagram: DiagramModel,
  reading: GuidedReading,
  decisionId: string,
  ctx: KindContext,
): GuidedOutcome {
  const laneId = reading.laneOf.get(decisionId)!;
  const slot = (reading.outgoing.get(decisionId) ?? []).length;
  const at = provisionalPosition(diagram, reading, decisionId, laneId, "rectangle", slot);
  return {
    edit: {
      add: [newStepInput(ctx, NEW_STEP, laneId, "rectangle", at)],
      connect: [{ source: decisionId, target: NEW_STEP }],
    },
    select: NEW_STEP,
    editLabel: true,
  };
}

/**
 * A palette step inserted in guided mode: after the selected step (like Tab, with that shape),
 * else into the selected lane, else into the first lane, unconnected.
 */
export function guidedInsertStep(
  diagram: DiagramModel,
  selectedIds: readonly string[],
  shape: FlowNodeShape,
  ctx: KindContext,
): GuidedOutcome {
  const reading = readGuided(diagram);
  const selected = selectedIds.length === 1 ? selectedIds[0]! : null;
  const step = selected ? reading.steps.get(selected) : undefined;
  if (step && !isGuidedEnd(step)) {
    const laneId = reading.laneOf.get(step.id)!;
    const slot = isGuidedDecision(step) ? (reading.outgoing.get(step.id) ?? []).length : 0;
    const at = provisionalPosition(diagram, reading, step.id, laneId, shape, slot);
    return {
      edit: {
        add: [newStepInput(ctx, NEW_STEP, laneId, shape, at)],
        connect: [{ source: step.id, target: NEW_STEP }],
      },
      select: NEW_STEP,
      editLabel: true,
    };
  }
  const lane =
    (selected ? reading.lanes.find((l) => l.id === selected) : undefined) ?? reading.lanes[0];
  if (!lane) return refused("selectOneStep");
  // The lane's last step, so the new one lands after what is already there.
  const inLane = [...reading.laneOf].filter(([, owner]) => owner === lane.id).map(([id]) => id);
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const along = (id: string) =>
    (diagram.direction === "TB" ? nodeLayouts[id]?.y : nodeLayouts[id]?.x) ?? 0;
  const last = inLane.sort((a, b) => along(b) - along(a))[0];
  const at = last
    ? provisionalPosition(diagram, reading, last, lane.id, shape)
    : diagram.direction === "TB"
      ? { x: LANE_MIN_DEPTH / 2 - stepSize(shape).width / 2, y: LANE_HEADER + LANE_INSET }
      : { x: LANE_HEADER + LANE_INSET, y: LANE_MIN_DEPTH / 2 - stepSize(shape).height / 2 };
  return {
    edit: { add: [newStepInput(ctx, NEW_STEP, lane.id, shape, at)] },
    select: NEW_STEP,
    editLabel: true,
  };
}

/** Shift+Tab: a branch — a decision's new exit, or a decision inserted after the step. */
export function guidedAddBranch(
  diagram: DiagramModel,
  selectedIds: readonly string[],
  ctx: KindContext,
): GuidedOutcome {
  const found = singleSelectedStep(diagram, selectedIds);
  if (!found) return refused("selectOneStep");
  const { reading, step } = found;
  if (isGuidedDecision(step)) return guidedAddExit(diagram, reading, step.id, ctx);
  if (isGuidedEnd(step)) return refused("endHasNoNext");
  const laneId = reading.laneOf.get(step.id)!;
  const exits = reading.outgoing.get(step.id) ?? [];
  const decisionAt = provisionalPosition(diagram, reading, step.id, laneId, "diamond");
  const decision = newStepInput(ctx, NEW_DECISION, laneId, "diamond", decisionAt);
  const stepAt = {
    x: decisionAt.x + (diagram.direction === "TB" ? 0 : stepSize("diamond").width + COLUMN_GAP),
    y: decisionAt.y + (diagram.direction === "TB" ? stepSize("diamond").height + COLUMN_GAP : 0),
  };
  const branch = newStepInput(ctx, NEW_STEP, laneId, "rectangle", {
    x: stepAt.x,
    y:
      stepAt.y +
      (exits.length > 0 && diagram.direction !== "TB"
        ? stepSize("rectangle").height + STACK_GAP
        : 0),
  });
  return {
    edit: {
      add: [decision, branch],
      // The step's existing exits now leave the decision: they become its first exits.
      reconnect: exits.map((exit) => ({ id: exit.id, source: NEW_DECISION })),
      connect: [
        { source: step.id, target: NEW_DECISION },
        { source: NEW_DECISION, target: NEW_STEP },
      ],
    },
    select: NEW_STEP,
    editLabel: true,
  };
}

/** Alt+↑ / Alt+↓: the selected step into the lane above or below, connections untouched. */
export function guidedMoveToLane(
  diagram: DiagramModel,
  selectedIds: readonly string[],
  offset: 1 | -1,
): GuidedOutcome {
  const found = singleSelectedStep(diagram, selectedIds);
  if (!found) return refused("selectOneStep");
  const { reading, step } = found;
  const laneId = reading.laneOf.get(step.id)!;
  const target = neighbourLane(reading, laneId, offset);
  if (!target) return { edit: {} };
  return guidedMoveStepToLane(diagram, reading, step.id, target.id);
}

/** The step into `laneId`, keeping its place along the axis. */
export function guidedMoveStepToLane(
  diagram: DiagramModel,
  reading: GuidedReading,
  stepId: string,
  laneId: string,
): GuidedOutcome {
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const fromLane = nodeLayouts[reading.laneOf.get(stepId) ?? ""];
  const toLane = nodeLayouts[laneId];
  const layout = nodeLayouts[stepId];
  if (!layout || !toLane || reading.laneOf.get(stepId) === laneId) return { edit: {} };
  const vertical = diagram.direction === "TB";
  const alongAbs = vertical ? (fromLane?.y ?? 0) + layout.y : (fromLane?.x ?? 0) + layout.x;
  const depth = vertical ? (toLane.width ?? LANE_MIN_DEPTH) : (toLane.height ?? LANE_MIN_DEPTH);
  const size = vertical ? (layout.width ?? 0) : (layout.height ?? 0);
  const across = Math.max(0, depth / 2 - size / 2);
  return {
    edit: {
      reparent: [
        vertical
          ? { id: stepId, parent: laneId, x: across, y: alongAbs - toLane.y }
          : { id: stepId, parent: laneId, x: alongAbs - toLane.x, y: across },
      ],
    },
    select: stepId,
  };
}

/**
 * Delete: removes the step and sews the sequence — each predecessor continues
 * to the step's first exit, with that exit's label. A decision keeps its first
 * exit as the continuation; the steps of its other exits go only when nothing
 * else reaches them. The only start step stays.
 */
export function guidedDeleteStep(
  diagram: DiagramModel,
  selectedIds: readonly string[],
): GuidedOutcome {
  if (selectedIds.length === 0) return refused("selectOneStep");
  const reading = readGuided(diagram);
  const steps = selectedIds.map((id) => reading.steps.get(id));
  if (steps.some((step) => step === undefined)) return refused("selectOneStep");
  const doomed = new Set(selectedIds);
  if (reading.starts.length > 0 && reading.starts.every((start) => doomed.has(start.id)))
    return refused("keepStart");

  // A decision takes the branches only it reaches (its first exit carries on).
  for (const step of steps) {
    if (!step || !isGuidedDecision(step)) continue;
    const exits = reading.outgoing.get(step.id) ?? [];
    for (const other of exits.slice(1)) {
      const reachedElsewhere = (reading.incoming.get(other.targetId) ?? []).some(
        (connection) => !doomed.has(connection.sourceId),
      );
      if (!reachedElsewhere && other.targetId !== exits[0]?.targetId) doomed.add(other.targetId);
    }
  }

  /** Where the sequence picks up after a removed run entered at `id`, and the label it arrives with. */
  const landing = (id: string): { target: string; label: string } | null => {
    const seen = new Set<string>();
    let at = id;
    while (doomed.has(at) && !seen.has(at)) {
      seen.add(at);
      const continuation = reading.outgoing.get(at)?.[0];
      if (!continuation) return null;
      if (!doomed.has(continuation.targetId))
        return { target: continuation.targetId, label: continuation.label ?? "" };
      at = continuation.targetId;
    }
    return null;
  };

  const existing = new Set(
    [...reading.outgoing.values()].flat().map((c) => `${c.sourceId}→${c.targetId}`),
  );
  const connect: { source: string; target: string; label: string }[] = [];
  let select: string | undefined;
  for (const id of selectedIds) {
    for (const entry of reading.incoming.get(id) ?? []) {
      if (doomed.has(entry.sourceId)) continue;
      select ??= entry.sourceId;
      const to = landing(id);
      if (!to) continue;
      const key = `${entry.sourceId}→${to.target}`;
      if (existing.has(key)) continue;
      existing.add(key);
      connect.push({ source: entry.sourceId, target: to.target, label: to.label });
    }
  }
  return { edit: { remove: [...doomed], connect }, ...(select ? { select } : {}) };
}

/**
 * Enter: label the exits of a decision from the keyboard. On the decision it
 * opens the first exit without a label (or the first exit); on an exit — the
 * label just written — the next one still unlabelled, and once none is left
 * it goes back to the decision.
 */
export function guidedLabelExit(
  diagram: DiagramModel,
  selectedIds: readonly string[],
): GuidedOutcome {
  if (selectedIds.length !== 1) return refused("selectOneStep");
  const reading = readGuided(diagram);
  const id = selectedIds[0]!;
  const unlabelled = (exits: readonly { id: string; label?: string }[], skip?: string) =>
    exits.find((exit) => exit.id !== skip && !exit.label?.trim());

  if (reading.steps.has(id)) {
    const exits = reading.outgoing.get(id) ?? [];
    const exit = unlabelled(exits) ?? exits[0];
    if (!exit) return refused("selectOneStep");
    return { edit: {}, selectConnection: exit.id, editLabel: true };
  }
  const connection = [...reading.outgoing.values()].flat().find((c) => c.id === id);
  if (!connection) return refused("selectOneStep");
  const next = unlabelled(reading.outgoing.get(connection.sourceId) ?? [], connection.id);
  return next
    ? { edit: {}, selectConnection: next.id, editLabel: true }
    : { edit: {}, select: connection.sourceId };
}

// ─── Lanes ──────────────────────────────────────────────────────────────────

function laneFrame(diagram: DiagramModel, reading: GuidedReading) {
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const vertical = diagram.direction === "TB";
  const last = reading.lanes[reading.lanes.length - 1];
  const lastLayout = last ? nodeLayouts[last.id] : undefined;
  const length = Math.max(
    LANE_MIN_LENGTH,
    ...reading.lanes.map((lane) => {
      const layout = nodeLayouts[lane.id];
      return (vertical ? layout?.height : layout?.width) ?? LANE_MIN_LENGTH;
    }),
  );
  return { nodeLayouts, vertical, lastLayout, length };
}

/** A new lane, after `afterLaneId` (or last), named `name`. */
export function guidedAddLane(diagram: DiagramModel, name: string, afterLaneId?: string): KindEdit {
  const reading = readGuided(diagram);
  const { nodeLayouts, vertical, lastLayout, length } = laneFrame(diagram, reading);
  const after = afterLaneId ? nodeLayouts[afterLaneId] : lastLayout;
  const position = after
    ? vertical
      ? { x: after.x + (after.width ?? LANE_MIN_DEPTH), y: after.y }
      : { x: after.x, y: after.y + (after.height ?? LANE_MIN_DEPTH) }
    : { x: 0, y: 0 };
  // Lanes after the insertion point move one lane along, so the new one has its place.
  const index = afterLaneId ? reading.lanes.findIndex((lane) => lane.id === afterLaneId) : -1;
  const move =
    index >= 0
      ? reading.lanes.slice(index + 1).flatMap((lane) => {
          const layout = nodeLayouts[lane.id];
          if (!layout) return [];
          return [
            vertical
              ? { id: lane.id, x: layout.x + LANE_MIN_DEPTH, y: layout.y }
              : { id: lane.id, x: layout.x, y: layout.y + LANE_MIN_DEPTH },
          ];
        })
      : [];
  return {
    add: [
      {
        key: "new-lane",
        type: COMPONENT_TYPE_PANEL,
        panelKind: PanelKind.Swimlane,
        name,
        parent: null,
        lane: {
          orientation: vertical ? "vertical" : "horizontal",
          color: laneColor(index >= 0 ? index + 1 : reading.lanes.length),
        },
        ...position,
        width: vertical ? LANE_MIN_DEPTH : length,
        height: vertical ? length : LANE_MIN_DEPTH,
      },
    ],
    move,
  };
}

/** New lanes named `names`, stacked after the last lane (keys from `keyOf`). */
export function guidedAppendLanes(
  diagram: DiagramModel,
  names: readonly string[],
  keyOf: (index: number) => string,
): KindNodeInput[] {
  const reading = readGuided(diagram);
  const { vertical, lastLayout, length } = laneFrame(diagram, reading);
  const base = lastLayout
    ? vertical
      ? { x: lastLayout.x + (lastLayout.width ?? LANE_MIN_DEPTH), y: lastLayout.y }
      : { x: lastLayout.x, y: lastLayout.y + (lastLayout.height ?? LANE_MIN_DEPTH) }
    : { x: 0, y: 0 };
  return names.map((name, index) => ({
    key: keyOf(index),
    type: COMPONENT_TYPE_PANEL,
    panelKind: PanelKind.Swimlane,
    name,
    parent: null,
    lane: {
      orientation: vertical ? "vertical" : "horizontal",
      color: laneColor(reading.lanes.length + index),
    },
    x: vertical ? base.x + index * LANE_MIN_DEPTH : base.x,
    y: vertical ? base.y : base.y + index * LANE_MIN_DEPTH,
    width: vertical ? LANE_MIN_DEPTH : length,
    height: vertical ? length : LANE_MIN_DEPTH,
  }));
}

/**
 * Swaps a lane with its neighbour (`-1` up/left, `+1` down/right) in the stored
 * lane order; the arrangement then re-packs the bands in that order.
 */
export function guidedMoveLane(diagram: DiagramModel, laneId: string, offset: 1 | -1): KindEdit {
  const reading = readGuided(diagram);
  const index = reading.lanes.findIndex((lane) => lane.id === laneId);
  const other = neighbourLane(reading, laneId, offset);
  if (index < 0 || !other) return {};
  const order = reading.lanes.map((lane) => lane.id);
  order[index] = other.id;
  order[index + offset] = laneId;
  return { kindData: { ...(diagram.kindData ?? {}), [GUIDED_LANE_ORDER_KEY]: order } };
}

/**
 * Removes a lane; its steps move to the lane above (or below, for the first).
 * Refused for the last lane.
 */
export function guidedRemoveLane(
  diagram: DiagramModel,
  laneId: string,
): KindEdit | { refused: KindText } {
  const reading = readGuided(diagram);
  if (reading.lanes.length <= 1) return refused("keepLastLane");
  const target = neighbourLane(reading, laneId, -1) ?? neighbourLane(reading, laneId, 1);
  if (!target) return refused("keepLastLane");
  const reparent: NonNullable<KindEdit["reparent"]> = [];
  for (const [stepId, owner] of reading.laneOf) {
    if (owner !== laneId) continue;
    const outcome = guidedMoveStepToLane(diagram, reading, stepId, target.id);
    if ("edit" in outcome) reparent.push(...(outcome.edit.reparent ?? []));
  }
  return { reparent, remove: [laneId] };
}

/** The guided creation template: two lanes and a start step in the first. */
export function guidedCreate(ctx: KindContext): { edit: KindEdit; select: string } {
  const vertical = ctx.direction === "TB";
  const size = stepSize("start");
  const lane = (key: string, name: string, index: number): KindNodeInput => ({
    key,
    type: COMPONENT_TYPE_PANEL,
    panelKind: PanelKind.Swimlane,
    name,
    parent: null,
    lane: { orientation: vertical ? "vertical" : "horizontal", color: laneColor(index) },
    x: vertical ? index * LANE_MIN_DEPTH : 0,
    y: vertical ? 0 : index * LANE_MIN_DEPTH,
    width: vertical ? LANE_MIN_DEPTH : LANE_MIN_LENGTH,
    height: vertical ? LANE_MIN_LENGTH : LANE_MIN_DEPTH,
  });
  const along = LANE_HEADER + LANE_INSET;
  const across = LANE_MIN_DEPTH / 2 - size.height / 2;
  return {
    edit: {
      add: [
        lane("lane-1", ctx.t("diagramKinds.guided.lanes.first"), 0),
        lane("lane-2", ctx.t("diagramKinds.guided.lanes.second"), 1),
        {
          key: "start",
          type: COMPONENT_TYPE_PROCESS_NODE,
          flowShape: "start",
          name: ctx.t("diagramKinds.guided.startName"),
          parent: "lane-1",
          x: vertical ? across : along,
          y: vertical ? along : across,
          width: size.width,
          height: size.height,
        },
      ],
    },
    select: "start",
  };
}

// ─── Step kind ──────────────────────────────────────────────────────────────

/**
 * The step drawn as another journey shape (spec guided-editing-surfaces): an
 * end has nothing after it, and a journey keeps exactly one start.
 */
export function guidedChangeShape(
  diagram: DiagramModel,
  stepId: string,
  shape: FlowNodeShape,
): GuidedOutcome {
  const reading = readGuided(diagram);
  const step = reading.steps.get(stepId);
  if (!step) return refused("selectOneStep");
  if (step.flowShape === shape) return { edit: {}, select: stepId };
  if (shape === "end" && (reading.outgoing.get(stepId)?.length ?? 0) > 0)
    return refused("endHasNoNext");
  if (step.flowShape === "start" && reading.starts.length <= 1) return refused("keepStart");
  if (shape === "start" && reading.starts.length > 0) return refused("oneStart");
  const layout = getCachedCanvasSnapshot(diagram).nodeLayouts[stepId];
  const size = stepSize(shape);
  return {
    edit: {
      update: [{ id: stepId, flowShape: shape }],
      ...(layout && {
        move: [{ id: stepId, x: layout.x, y: layout.y, width: size.width, height: size.height }],
      }),
    },
    select: stepId,
  };
}

/**
 * The step into a new lane, added after the last one (spec guided-editing-surfaces):
 * one edit, so one undo removes the lane and puts the step back.
 */
export function guidedMoveStepToNewLane(
  diagram: DiagramModel,
  stepId: string,
  name: string,
): GuidedOutcome {
  const reading = readGuided(diagram);
  if (!reading.steps.has(stepId)) return refused("selectOneStep");
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const layout = nodeLayouts[stepId];
  const fromLane = nodeLayouts[reading.laneOf.get(stepId) ?? ""];
  const laneEdit = guidedAddLane(diagram, name);
  const lane = laneEdit.add![0]!;
  if (!layout) return { edit: laneEdit, select: stepId };
  const vertical = diagram.direction === "TB";
  const alongAbs = vertical ? (fromLane?.y ?? 0) + layout.y : (fromLane?.x ?? 0) + layout.x;
  const size = vertical ? (layout.width ?? 0) : (layout.height ?? 0);
  const across = Math.max(0, LANE_MIN_DEPTH / 2 - size / 2);
  return {
    edit: {
      ...laneEdit,
      reparent: [
        vertical
          ? { id: stepId, parent: lane.key, x: across, y: alongAbs - lane.y }
          : { id: stepId, parent: lane.key, x: alongAbs - lane.x, y: across },
      ],
    },
    select: stepId,
  };
}

// ─── Kind data on a step ────────────────────────────────────────────────────

/** The step's `kindProps` with `key` set to `value`, or removed when null (empty → null). */
function mergedKindProps(
  step: { kindProps?: JsonObject },
  key: string,
  value: JsonValue | null,
): JsonObject | null {
  const next: JsonObject = { ...(step.kindProps ?? {}) };
  if (value === null) delete next[key];
  else next[key] = value;
  return Object.keys(next).length > 0 ? next : null;
}

/** The step's experience score (1–5), or none (spec guided-journey-experience). */
export function guidedSetExperience(
  diagram: DiagramModel,
  stepId: string,
  score: number | null,
): GuidedOutcome {
  const step = readGuided(diagram).steps.get(stepId);
  if (!step) return refused("selectOneStep");
  return {
    edit: { update: [{ id: stepId, kindProps: mergedKindProps(step, "experience", score) }] },
    select: stepId,
  };
}
