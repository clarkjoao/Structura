import type { Component, FlowNodeShape } from "@/features/diagram/model/component.types";
import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { JsonObject } from "@/features/diagram/model/diagram-kind";
import type { KindEdit } from "@/features/diagram/model/kind-edit.types";
import { COMPONENT_TYPE_PROCESS_NODE } from "@/features/diagram/model/component-type-constants";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import type { KindContext, KindTextBase, KindTextChange } from "../kind.types";
import { guidedAppendLanes, guidedMoveStepToLane, guidedSetVisibilityLine } from "./guided.edits";
import { COLUMN_GAP, LANE_HEADER, LANE_INSET, LANE_MIN_DEPTH, stepSize } from "./guided.geometry";
import {
  type GuidedReading,
  cleanParticipants,
  isGuidedDecision,
  isGuidedEnd,
  participantsOf,
  readGuided,
  visibilityLaneOf,
} from "./guided.model";
import { alignLines } from "./guided.outline.align";
import { mergeKindEdits } from "../kindEditMerge";
import {
  type OutlineError,
  type OutlineItem,
  type OutlineNode,
  parseOutline,
} from "./guided.outline.parse";
import { guidedPhases, phaseStartOf } from "./guided.phases";

/**
 * A whole-journey text turned back into a guided edit (spec guided-journey-text-sync):
 * the edited text is read against the text the panel wrote (`base`), each line
 * bound to its step by alignment or by its handle, and only the difference is
 * applied — renames, kinds, lanes, scores, phases, steps added and removed, and
 * the connections the text writes. What the text does not write is never touched.
 * Each change carries its own part of the edit, so a reviewer may take a subset.
 */

export type OutlineReconcile =
  | { edit: KindEdit; changes: KindTextChange[]; skipped: number; select?: string }
  | { errors: OutlineError[] };

type NodeKind = OutlineNode["kind"];

const SHAPE: Record<NodeKind, FlowNodeShape> = {
  step: "rectangle",
  decision: "diamond",
  end: "end",
};

const nameKey = (name: string) => name.trim().toLowerCase();

const kindOf = (step: Component): NodeKind =>
  isGuidedDecision(step) ? "decision" : isGuidedEnd(step) ? "end" : "step";

const changeLabel = (kind: KindTextChange["kind"]) => ({
  key: `diagramKinds.guided.text.changes.${kind}`,
});

/** Every element line of the outline, depth first in text order. */
function nodesOf(items: readonly OutlineItem[], out: OutlineNode[] = []): OutlineNode[] {
  for (const item of items) {
    if (item.kind === "jump") continue;
    if (item.kind !== "fanout") out.push(item);
    for (const exit of item.exits) nodesOf(exit.body, out);
  }
  return out;
}

function alongOf(diagram: DiagramModel, reading: GuidedReading, id: string): number {
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const layout = nodeLayouts[id];
  const lane = nodeLayouts[reading.laneOf.get(id) ?? ""];
  if (!layout) return 0;
  return diagram.direction === "TB"
    ? (lane?.y ?? 0) + layout.y + (layout.height ?? 0)
    : (lane?.x ?? 0) + layout.x + (layout.width ?? 0);
}

export function reconcileOutline(
  diagram: DiagramModel,
  base: KindTextBase,
  edited: string,
  ctx: KindContext,
): OutlineReconcile {
  const parsed = parseOutline(edited);
  if (parsed.errors.length > 0) return { errors: parsed.errors };
  const reading = readGuided(diagram);
  const errors: OutlineError[] = [];
  const nodes = nodesOf(parsed.items);

  // Which line is which step: handles first, then the line alignment.
  const claimed = new Map<number, string>();
  const byHandle = new Set<string>();
  const handleLine = new Map<string, number>();
  for (const node of nodes) {
    if (!node.handle) continue;
    const id = base.handles[node.handle];
    if (!id)
      errors.push({ line: node.line, code: "unknownHandle", values: { handle: node.handle } });
    else if (handleLine.has(node.handle))
      errors.push({ line: node.line, code: "duplicateHandle", values: { handle: node.handle } });
    else {
      handleLine.set(node.handle, node.line);
      claimed.set(node.line, id);
      byHandle.add(id);
    }
  }
  if (errors.length > 0) return { errors };
  const aligned = alignLines(
    base.text.split("\n"),
    base.lineIds,
    edited.split("\n"),
    new Set(nodes.filter((n) => !n.handle).map((n) => n.line)),
  );
  for (const [line, id] of aligned)
    if (!byHandle.has(id) && !claimed.has(line)) claimed.set(line, id);
  // An element claimed twice by alignment keeps its first line; the other is new.
  const seenIds = new Set<string>();
  for (const node of nodes) {
    const id = claimed.get(node.line);
    if (!id) continue;
    if (seenIds.has(id)) claimed.delete(node.line);
    else seenIds.add(id);
  }

  // Lanes: existing by name, else added after the last, in order of first mention.
  const laneByName = new Map<string, string>();
  for (const lane of reading.lanes)
    if (!laneByName.has(nameKey(lane.name))) laneByName.set(nameKey(lane.name), lane.id);
  const missingLanes = parsed.lanes.filter(
    (name, index) =>
      !laneByName.has(nameKey(name)) &&
      parsed.lanes.findIndex((other) => nameKey(other) === nameKey(name)) === index,
  );
  const newLanes = guidedAppendLanes(diagram, missingLanes, (i) => `text-lane-${i}`);
  const laneInput = new Map(newLanes.map((input) => [input.key, input]));
  newLanes.forEach((input) => laneByName.set(nameKey(input.name), input.key));
  const firstLane = reading.lanes[0]?.id ?? newLanes[0]?.key;
  const laneOfItem = (item: OutlineNode) =>
    (item.lane && laneByName.get(nameKey(item.lane))) || firstLane!;
  const laneParts = (laneKey: string): KindEdit =>
    laneInput.has(laneKey) ? { add: [laneInput.get(laneKey)!] } : {};

  const changes: KindTextChange[] = [];
  const nameOfRef = new Map<string, string>();
  let skipped = 0;
  const vertical = diagram.direction === "TB";
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);

  // The parts of an added step: itself, the lane it needs, and every connection touching it.
  const addParts = new Map<string, KindEdit[]>();
  const refOfLine = new Map<number, string | null>();
  let added = 0;
  let lastAlong = reading.starts[0] ? alongOf(diagram, reading, reading.starts[0].id) : 0;

  for (const node of nodes) {
    const id = claimed.get(node.line);
    if (id && !reading.steps.has(id)) {
      // Deleted on the canvas since the text was written: its changes are left out.
      refOfLine.set(node.line, null);
      skipped += 1;
      continue;
    }
    const laneKey = laneOfItem(node);
    if (id) {
      const step = reading.steps.get(id)!;
      refOfLine.set(node.line, id);
      nameOfRef.set(id, step.name);
      lastAlong = alongOf(diagram, reading, id);
      const name = node.name || (node.kind === "end" ? step.name : "");
      const values = { name: step.name };
      if (name && name !== step.name)
        changes.push({
          key: `rename:${id}`,
          kind: "rename",
          elementId: id,
          label: changeLabel("rename"),
          values: { ...values, after: name },
          edit: { update: [{ id, name }] },
        });
      if (node.kind !== kindOf(step))
        changes.push({
          key: `kind:${id}`,
          kind: "kind",
          elementId: id,
          label: changeLabel("kind"),
          values: {
            ...values,
            after: ctx.t(`diagramKinds.guided.stepKinds.${node.shape ?? SHAPE[node.kind]}`),
          },
          edit: { update: [{ id, flowShape: node.shape ?? SHAPE[node.kind] }] },
        });
      if (laneKey !== reading.laneOf.get(id)) {
        const input = laneInput.get(laneKey);
        const move: KindEdit = input
          ? (() => {
              const layout = nodeLayouts[id];
              const from = nodeLayouts[reading.laneOf.get(id) ?? ""];
              const alongAbs = vertical
                ? (from?.y ?? 0) + (layout?.y ?? 0)
                : (from?.x ?? 0) + (layout?.x ?? 0);
              const across =
                LANE_MIN_DEPTH / 2 - (vertical ? (layout?.width ?? 0) : (layout?.height ?? 0)) / 2;
              return {
                reparent: [
                  vertical
                    ? { id, parent: laneKey, x: across, y: alongAbs - input.y }
                    : { id, parent: laneKey, x: alongAbs - input.x, y: across },
                ],
              };
            })()
          : (() => {
              const moved = guidedMoveStepToLane(diagram, reading, id, laneKey);
              return "edit" in moved ? moved.edit : {};
            })();
        changes.push({
          key: `lane:${id}`,
          kind: "lane",
          elementId: id,
          label: changeLabel("lane"),
          values: { ...values, after: node.lane ?? "" },
          edit: mergeKindEdits(reading.components, [laneParts(laneKey), move]),
        });
      }
      const participants = cleanParticipants(node.participants ?? [], node.lane ?? undefined);
      const currentParticipants = participantsOf(
        step,
        reading.lanes.find((l) => l.id === reading.laneOf.get(id))?.name,
      );
      if (participants.join("\u0000") !== currentParticipants.join("\u0000"))
        changes.push({
          key: `participants:${id}`,
          kind: "participants",
          elementId: id,
          label: changeLabel("participants"),
          values: {
            ...values,
            before: currentParticipants.join(", ") || "—",
            after: participants.join(", ") || "—",
          },
          edit: {
            update: [{ id, kindProps: patchedList(step, "participants", participants) }],
          },
        });
      const phase = node.phase ?? null;
      if (phase !== phaseStartOf(step))
        changes.push({
          key: `phase:${id}`,
          kind: "phase",
          elementId: id,
          label: changeLabel("phase"),
          values: { ...values, before: phaseStartOf(step) ?? "—", after: phase ?? "—" },
          edit: { update: [{ id, kindProps: patched(step, "phase", phase) }] },
        });
      continue;
    }
    // A new step, placed after the one before it; the arrangement settles it.
    const key = `text-${added++}`;
    refOfLine.set(node.line, key);
    const shape = node.shape ?? SHAPE[node.kind];
    const size = stepSize(shape);
    lastAlong += COLUMN_GAP + stepSize("rectangle").width;
    const laneAlong = laneInput.get(laneKey)
      ? vertical
        ? laneInput.get(laneKey)!.y
        : laneInput.get(laneKey)!.x
      : ((vertical ? nodeLayouts[laneKey]?.y : nodeLayouts[laneKey]?.x) ?? 0);
    const along = Math.max(LANE_HEADER + LANE_INSET, lastAlong - laneAlong);
    const across = LANE_MIN_DEPTH / 2 - (vertical ? size.width : size.height) / 2;
    const name = node.name || ctx.t("diagramKinds.guided.endName");
    nameOfRef.set(key, name);
    addParts.set(key, [
      laneParts(laneKey),
      {
        add: [
          {
            key,
            type: COMPONENT_TYPE_PROCESS_NODE,
            flowShape: shape,
            name,
            parent: laneKey,
            ...((node.phase || node.participants?.length) && {
              kindProps: {
                ...(node.phase && { phase: node.phase }),
                ...(node.participants?.length && {
                  participants: cleanParticipants(node.participants, node.lane ?? undefined),
                }),
              },
            }),
            x: vertical ? across : along,
            y: vertical ? along : across,
            width: size.width,
            height: size.height,
          },
        ],
      },
    ]);
  }

  // Pairs of changes that only apply together (spec guided-assistant-revisions).
  const tied: Array<[string, string]> = [];

  // The connections the text asks for, walked as the outline is built.
  type Wanted = { source: string; target: string; label: string };
  const wanted: Wanted[] = [];
  const writtenByName = new Map<string, string>();
  const existingByName = new Map<string, string[]>();
  for (const step of reading.steps.values())
    existingByName.set(nameKey(step.name), [
      ...(existingByName.get(nameKey(step.name)) ?? []),
      step.id,
    ]);
  type Open = { source: string; label: string };
  const link = (open: Open[], target: string) => {
    for (const end of open) wanted.push({ source: end.source, target, label: end.label });
  };
  const walk = (items: readonly OutlineItem[], open: Open[]): Open[] => {
    let current = open;
    for (const item of items) {
      if (item.kind === "fanout") continue;
      if (item.kind === "jump") {
        const key = nameKey(item.target);
        const target =
          writtenByName.get(key) ??
          (existingByName.get(key)?.length === 1 ? existingByName.get(key)![0] : undefined);
        if (!target)
          errors.push({
            line: item.line,
            code: (existingByName.get(key)?.length ?? 0) > 1 ? "ambiguousJump" : "unknownJump",
            values: { name: item.target },
          });
        else link(current, target);
        current = [];
        continue;
      }
      const ref = refOfLine.get(item.line);
      if (ref === null || ref === undefined) {
        // A step left out: nothing connects to it, and its paths start afresh.
        current = [];
        if (item.exits.length > 0) for (const exit of item.exits) walk(exit.body, []);
        continue;
      }
      if (item.name) writtenByName.set(nameKey(item.name), ref);
      link(current, ref);
      if (item.kind === "end") current = [];
      else if (item.kind === "decision" || item.exits.length > 0)
        current = item.exits.flatMap((exit) =>
          walk(exit.body, [{ source: ref, label: exit.label }]),
        );
      else current = [{ source: ref, label: "" }];
    }
    return current;
  };
  const start = reading.starts[0];
  walk(parsed.items, start ? [{ source: start.id, label: "" }] : []);
  if (errors.length > 0) return { errors: errors.sort((a, b) => a.line - b.line) };

  // Removed: steps the base wrote that no line stands for any more.
  const kept = new Set(claimed.values());
  const removed = new Set(
    base.lineIds.filter(
      (id): id is string => id !== null && !kept.has(id) && reading.steps.has(id),
    ),
  );
  for (const id of removed) {
    changes.push({
      key: `remove:${id}`,
      kind: "remove",
      elementId: id,
      label: changeLabel("remove"),
      values: { name: reading.steps.get(id)!.name },
      edit: { remove: [id] },
    });
  }

  // Connections: matched against what the text wrote first, then any that exists.
  const written = base.writtenConnections
    .map((id) => reading.connections[id])
    .filter(
      (c): c is NonNullable<typeof c> =>
        !!c && reading.steps.has(c.sourceId) && reading.steps.has(c.targetId),
    );
  const others = Object.values(reading.connections).filter(
    (c) => !base.writtenConnections.includes(c.id),
  );
  const matched = new Set<string>();
  const nameOf = (ref: string) => nameOfRef.get(ref) ?? reading.steps.get(ref)?.name ?? "";
  for (const want of wanted) {
    const isNew = addParts.has(want.source) || addParts.has(want.target);
    const same = (c: { id: string; sourceId: string; targetId: string }) =>
      !matched.has(c.id) && c.sourceId === want.source && c.targetId === want.target;
    const existing = isNew ? undefined : (written.find(same) ?? others.find(same));
    if (existing) {
      matched.add(existing.id);
      if ((existing.label ?? "") !== want.label)
        changes.push({
          key: `relabel:${existing.id}`,
          kind: "relabel",
          elementId: existing.id,
          label: changeLabel("relabel"),
          values: { source: nameOf(want.source), target: nameOf(want.target), after: want.label },
          edit: { relabel: [{ id: existing.id, label: want.label }] },
        });
      continue;
    }
    const connect: KindEdit = {
      connect: [
        { source: want.source, target: want.target, ...(want.label && { label: want.label }) },
      ],
    };
    // A connection to an added step is part of that step; between two added steps, it ties them.
    const owner = addParts.get(want.target) ?? addParts.get(want.source);
    if (addParts.has(want.source) && addParts.has(want.target))
      tied.push([`add:${want.source}`, `add:${want.target}`]);
    if (owner) owner.push(connect);
    else
      changes.push({
        key: `connect:${want.source}>${want.target}`,
        kind: "connect",
        elementId: want.source,
        label: changeLabel("connect"),
        values: { source: nameOf(want.source), target: nameOf(want.target), label: want.label },
        edit: connect,
      });
  }
  for (const connection of written) {
    if (matched.has(connection.id)) continue;
    // A removed step takes its connections with it.
    if (removed.has(connection.sourceId) || removed.has(connection.targetId)) continue;
    changes.push({
      key: `disconnect:${connection.id}`,
      kind: "disconnect",
      elementId: connection.id,
      label: changeLabel("disconnect"),
      values: { source: nameOf(connection.sourceId), target: nameOf(connection.targetId) },
      edit: { disconnect: [connection.id] },
    });
  }

  for (const [key, parts] of addParts)
    changes.push({
      key: `add:${key}`,
      kind: "add",
      elementId: null,
      label: changeLabel("add"),
      values: { name: nameOfRef.get(key) ?? "" },
      edit: mergeKindEdits(reading.components, parts),
    });

  // The line of visibility (spec guided-journey-blueprint), from `---` in the lane declarations.
  const wantedLine = parsed.visibilityLane
    ? (laneByName.get(nameKey(parsed.visibilityLane)) ?? null)
    : null;
  const currentLine = visibilityLaneOf(diagram, reading);
  if (wantedLine !== currentLine) {
    const laneLabel = (laneId: string | null) =>
      laneId === null
        ? "—"
        : (reading.lanes.find((l) => l.id === laneId)?.name ?? laneInput.get(laneId)?.name ?? "");
    changes.push({
      key: "visibility",
      kind: "visibility",
      elementId: null,
      label: changeLabel("visibility"),
      values: { before: laneLabel(currentLine), after: laneLabel(wantedLine) },
      edit: mergeKindEdits(reading.components, [
        wantedLine ? laneParts(wantedLine) : {},
        guidedSetVisibilityLine(diagram, wantedLine),
      ]),
    });
  }

  const order: Record<KindTextChange["kind"], number> = {
    remove: 0,
    rename: 1,
    kind: 2,
    lane: 3,
    phase: 5,
    participants: 6,
    visibility: 7,
    add: 8,
    connect: 9,
    relabel: 10,
    disconnect: 11,
  };
  changes.sort((a, b) => order[a.kind] - order[b.kind]);
  describeChanges(changes, {
    reading,
    edited,
    nodes,
    claimed,
    refOfLine,
    removed,
    tied,
  });
  const first = changes.find((c) => c.kind !== "remove" && c.kind !== "disconnect");
  const select = first
    ? first.elementId && reading.steps.has(first.elementId)
      ? first.elementId
      : first.kind === "add"
        ? first.key.slice("add:".length)
        : undefined
    : undefined;
  return {
    edit: mergeKindEdits(
      reading.components,
      changes.map((change) => change.edit),
    ),
    changes,
    skipped,
    ...(select && { select }),
  };
}

/**
 * What a reviewer needs beside each change (spec guided-assistant-revisions):
 * its dependency group (an added step with the steps it connects to; a removed
 * step with the connection that sews its neighbours), the phase it falls in,
 * and the reason a `# why:` line above its step gives.
 */
function describeChanges(
  changes: KindTextChange[],
  input: {
    reading: GuidedReading;
    edited: string;
    nodes: readonly OutlineNode[];
    claimed: ReadonlyMap<number, string>;
    refOfLine: ReadonlyMap<number, string | null>;
    removed: ReadonlySet<string>;
    tied: ReadonlyArray<readonly [string, string]>;
  },
): void {
  const { reading, edited, nodes, claimed, refOfLine, removed, tied } = input;
  // Union-find over change keys.
  const parent = new Map(changes.map((c) => [c.key, c.key]));
  const find = (key: string): string => {
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(key, root);
    return root;
  };
  const union = (a: string, b: string) => {
    if (!parent.has(a) || !parent.has(b)) return;
    parent.set(find(b), find(a));
  };
  for (const [a, b] of tied) union(a, b);
  for (const id of removed) {
    const into = new Set((reading.incoming.get(id) ?? []).map((c) => c.sourceId));
    const out = new Set((reading.outgoing.get(id) ?? []).map((c) => c.targetId));
    // The phase a removed step started moves to the step after it.
    const startedPhase = phaseStartOf(reading.steps.get(id)!);
    for (const change of changes) {
      if (change.kind === "phase" && startedPhase && change.values.after === startedPhase)
        union(`remove:${id}`, change.key);
      if (change.kind !== "connect") continue;
      const [source, target] = change.key.slice("connect:".length).split(">");
      if (into.has(source!) && out.has(target!)) union(`remove:${id}`, change.key);
    }
  }

  // The line each element stands on, its phase in the revised text, and its reason.
  const lineOfRef = new Map<string, number>();
  for (const [line, id] of claimed) lineOfRef.set(id, line);
  for (const [line, ref] of refOfLine) if (ref) lineOfRef.set(ref, line);
  const phaseOfLine = new Map<number, string>();
  let phase: string | undefined;
  for (const node of [...nodes].sort((a, b) => a.line - b.line)) {
    if (node.phase) phase = node.phase;
    if (phase) phaseOfLine.set(node.line, phase);
  }
  const reasonOfLine = new Map<number, string>();
  const nodeLines = new Set(nodes.map((n) => n.line));
  let pending: string | null = null;
  edited.split("\n").forEach((raw, index) => {
    const why = /^\s*#\s*why:\s*(.+?)\s*$/i.exec(raw);
    if (why) pending = why[1]!;
    else if (pending && nodeLines.has(index + 1)) {
      reasonOfLine.set(index + 1, pending);
      pending = null;
    }
  });
  const { phases, phaseOf } = guidedPhases(reading);
  for (const change of changes) {
    change.group = find(change.key);
    const ref =
      change.kind === "add"
        ? change.key.slice("add:".length)
        : change.kind === "connect" || change.kind === "relabel" || change.kind === "disconnect"
          ? (reading.connections[change.elementId ?? ""]?.sourceId ??
            change.key.slice(change.key.indexOf(":") + 1).split(">")[0])
          : change.elementId;
    const line = ref ? lineOfRef.get(ref) : undefined;
    const current = ref ? phaseOf.get(ref) : undefined;
    const inPhase =
      (line !== undefined ? phaseOfLine.get(line) : undefined) ??
      (current !== undefined ? phases[current]?.name : undefined);
    if (inPhase) change.phase = inPhase;
    const reason = line !== undefined ? reasonOfLine.get(line) : undefined;
    if (reason) change.reason = reason;
  }
}

/** The step's kind data with a list set, or cleared when empty. */
function patchedList(step: Component, key: string, values: readonly string[]): JsonObject | null {
  const next: JsonObject = { ...(step.kindProps ?? {}) };
  if (values.length === 0) delete next[key];
  else next[key] = [...values];
  return Object.keys(next).length > 0 ? next : null;
}

/** The step's kind data with `key` set or cleared, as a whole for an update. */
function patched(step: Component, key: string, value: string | number | null): JsonObject | null {
  const next: JsonObject = { ...(step.kindProps ?? {}) };
  if (value === null) delete next[key];
  else next[key] = value;
  return Object.keys(next).length > 0 ? next : null;
}
