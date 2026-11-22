import type { FlowNodeShape } from "@/features/diagram/model/component.types";
import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type {
  KindEdgeInput,
  KindEdit,
  KindNodeInput,
} from "@/features/diagram/model/kind-edit.types";
import { COMPONENT_TYPE_PROCESS_NODE } from "@/features/diagram/model/component-type-constants";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import type { KindCommandOutcome, KindContext, KindText } from "../kind.types";
import { guidedAppendLanes } from "./guided.edits";
import { COLUMN_GAP, LANE_HEADER, LANE_INSET, LANE_MIN_DEPTH, stepSize } from "./guided.geometry";
import { type GuidedReading, isGuidedDecision, isGuidedEnd, readGuided } from "./guided.model";
import type { OutlineError, OutlineItem, ParsedOutline } from "./guided.outline.parse";

/** What an outline adds: shown by the panel, returned to the assistant. */
export interface OutlineAdded {
  lanes: number;
  steps: number;
  decisions: number;
}

export type OutlineBuild =
  | (KindCommandOutcome & { added: OutlineAdded })
  | { refused: KindText }
  | { errors: OutlineError[] };

const SHAPE: Record<"step" | "decision" | "end", FlowNodeShape> = {
  step: "rectangle",
  decision: "diamond",
  end: "end",
};

/** An open path end: where the next item connects from. */
interface OpenEnd {
  source: string;
  label?: string;
  /** The first connection re-wires this existing one instead of adding one (an insert). */
  reconnect?: string;
}

interface Anchor {
  open: OpenEnd[];
  /** The step the outline is inserted before: every open end connects to it at the end. */
  before?: string;
  /** Where along the axis the first item goes, in absolute terms. */
  along: number;
}

const refused = (code: string): { refused: KindText } => ({
  refused: { key: `diagramKinds.guided.refused.${code}` },
});

const nameKey = (name: string) => name.trim().toLowerCase();

function absoluteAlong(diagram: DiagramModel, reading: GuidedReading, id: string): number {
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const vertical = diagram.direction === "TB";
  const layout = nodeLayouts[id];
  const lane = reading.laneOf.get(id);
  const laneLayout = lane ? nodeLayouts[lane] : undefined;
  if (!layout) return 0;
  return vertical
    ? (laneLayout?.y ?? 0) + layout.y + (layout.height ?? 0)
    : (laneLayout?.x ?? 0) + layout.x + (layout.width ?? 0);
}

/** After `stepId`, as Tab adds after it. */
function anchorAfter(
  diagram: DiagramModel,
  reading: GuidedReading,
  stepId: string,
): Anchor | { refused: KindText } {
  const step = reading.steps.get(stepId)!;
  if (isGuidedEnd(step)) return refused("endHasNoNext");
  const along = absoluteAlong(diagram, reading, stepId);
  const exits = reading.outgoing.get(stepId) ?? [];
  if (!isGuidedDecision(step) && exits.length === 1) {
    const exit = exits[0]!;
    return { open: [{ source: stepId, reconnect: exit.id }], before: exit.targetId, along };
  }
  return { open: [{ source: stepId }], along };
}

/** No selection: the end of the main path (each decision's first exit), before its end step. */
function anchorAtEnd(diagram: DiagramModel, reading: GuidedReading): Anchor {
  const start = reading.starts[0];
  if (!start) return { open: [], along: 0 };
  const seen = new Set<string>([start.id]);
  let current = start.id;
  for (;;) {
    const exits = reading.outgoing.get(current) ?? [];
    const first = exits[0];
    if (!first)
      return { open: [{ source: current }], along: absoluteAlong(diagram, reading, current) };
    const target = reading.steps.get(first.targetId)!;
    if (isGuidedEnd(target) || seen.has(target.id)) {
      // Inserted on that connection, before the end (or the loop back).
      return {
        open: [{ source: current, reconnect: first.id }],
        before: target.id,
        along: absoluteAlong(diagram, reading, current),
      };
    }
    seen.add(target.id);
    current = target.id;
  }
}

/**
 * Turns a parsed outline into one guided edit (spec guided-journey-outline):
 * lanes by name (created when missing), steps in sequence after the anchor,
 * exits labelled, open paths converging, jumps to steps written before.
 */
export function buildOutline(
  diagram: DiagramModel,
  outline: ParsedOutline,
  selectedIds: readonly string[],
  ctx: KindContext,
): OutlineBuild {
  if (outline.errors.length > 0) return { errors: outline.errors };
  if (outline.items.length === 0 && outline.lanes.length === 0)
    return { edit: {}, added: { lanes: 0, steps: 0, decisions: 0 } };
  const reading = readGuided(diagram);
  const errors: OutlineError[] = [];

  const selected =
    selectedIds.length === 1 && reading.steps.has(selectedIds[0]!) ? selectedIds[0]! : null;
  const anchor = selected ? anchorAfter(diagram, reading, selected) : anchorAtEnd(diagram, reading);
  if ("refused" in anchor) return anchor;

  // Lanes: existing by name, else new ones after the last, in order of first mention.
  const laneByName = new Map<string, string>();
  for (const lane of reading.lanes) {
    const key = nameKey(lane.name);
    if (!laneByName.has(key)) laneByName.set(key, lane.id);
  }
  const fallbackLaneName = ctx.t("diagramKinds.guided.lanes.newLane");
  const missing: string[] = [];
  const wanted = [...outline.lanes];
  if (reading.lanes.length === 0 && wanted.length === 0) wanted.push(fallbackLaneName);
  for (const name of wanted) {
    if (!laneByName.has(nameKey(name)) && !missing.some((m) => nameKey(m) === nameKey(name)))
      missing.push(name);
  }
  const newLanes = guidedAppendLanes(diagram, missing, (i) => `outline-lane-${i}`);
  newLanes.forEach((input) => laneByName.set(nameKey(input.name), input.key));
  const firstLane = reading.lanes[0]?.id ?? newLanes[0]?.key;

  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const vertical = diagram.direction === "TB";
  const laneAlong = new Map<string, number>();
  for (const lane of reading.lanes) {
    const layout = nodeLayouts[lane.id];
    laneAlong.set(lane.id, (vertical ? layout?.y : layout?.x) ?? 0);
  }
  for (const input of newLanes) laneAlong.set(input.key, vertical ? input.y : input.x);

  const existingByName = new Map<string, string[]>();
  for (const step of reading.steps.values()) {
    const key = nameKey(step.name);
    existingByName.set(key, [...(existingByName.get(key) ?? []), step.id]);
  }

  const add: KindNodeInput[] = [...newLanes];
  const connect: KindEdgeInput[] = [];
  const reconnect: NonNullable<KindEdit["reconnect"]> = [];
  const writtenByName = new Map<string, string>();
  const writtenByRef = new Map<string, string>();
  const added: OutlineAdded = { lanes: newLanes.length, steps: 0, decisions: 0 };
  let column = 0;
  let lastKey: string | undefined;

  const link = (open: OpenEnd[], target: string) => {
    for (const end of open) {
      if (end.reconnect) reconnect.push({ id: end.reconnect, target });
      else connect.push({ source: end.source, target, ...(end.label ? { label: end.label } : {}) });
    }
  };

  const walk = (items: OutlineItem[], open: OpenEnd[]): OpenEnd[] => {
    let current = open;
    for (const item of items) {
      if (item.kind === "fanout") {
        // Every branch leaves the same open ends; only the first may re-wire an existing
        // connection (an insert), the others add their own.
        const from = current;
        current = item.exits.flatMap((exit, index) =>
          walk(
            exit.body,
            from.map((end) => {
              const { reconnect: wire, ...plain } = end;
              const base = index === 0 && wire ? end : plain;
              return exit.label ? { ...base, label: exit.label } : base;
            }),
          ),
        );
        continue;
      }
      if (item.kind === "jump") {
        const key = nameKey(item.target);
        const target =
          (item.ref ? writtenByRef.get(item.ref) : undefined) ??
          writtenByName.get(key) ??
          (existingByName.get(key)?.length === 1 ? existingByName.get(key)![0] : undefined);
        if (!target) {
          const ambiguous = (existingByName.get(key)?.length ?? 0) > 1;
          errors.push({
            line: item.line,
            code: ambiguous ? "ambiguousJump" : "unknownJump",
            values: { name: item.target },
          });
        } else link(current, target);
        current = [];
        continue;
      }
      const key = `outline-${add.length}`;
      const laneKey = (item.lane && laneByName.get(nameKey(item.lane))) || firstLane!;
      const shape = item.shape ?? SHAPE[item.kind];
      const size = stepSize(shape);
      column += 1;
      const alongAbs =
        anchor.along + COLUMN_GAP + (column - 1) * (stepSize("rectangle").width + COLUMN_GAP);
      const along = Math.max(LANE_HEADER + LANE_INSET, alongAbs - (laneAlong.get(laneKey) ?? 0));
      const across = LANE_MIN_DEPTH / 2 - (vertical ? size.width : size.height) / 2;
      add.push({
        key,
        type: COMPONENT_TYPE_PROCESS_NODE,
        flowShape: shape,
        name: item.name || ctx.t("diagramKinds.guided.endName"),
        parent: laneKey,
        ...(item.experience !== undefined && { kindProps: { experience: item.experience } }),
        x: vertical ? across : along,
        y: vertical ? along : across,
        width: size.width,
        height: size.height,
      });
      added.steps += 1;
      if (item.kind === "decision") added.decisions += 1;
      lastKey = key;
      if (item.name) writtenByName.set(nameKey(item.name), key);
      if (item.ref) writtenByRef.set(item.ref, key);
      link(current, key);
      if (item.kind === "end") {
        current = [];
      } else if (item.kind === "decision" || item.exits.length > 0) {
        current = item.exits.flatMap((exit) =>
          walk(exit.body, [{ source: key, ...(exit.label ? { label: exit.label } : {}) }]),
        );
      } else {
        current = [{ source: key }];
      }
    }
    return current;
  };

  const open = walk(outline.items, anchor.open);
  if (errors.length > 0) return { errors: errors.sort((a, b) => a.line - b.line) };
  if (anchor.before && outline.items.length > 0) {
    // An insert that closes every path would cut what came after it off.
    if (open.length === 0) return refused("outlineClosesPath");
    link(open, anchor.before);
  }
  return {
    edit: {
      add,
      ...(connect.length > 0 ? { connect } : {}),
      ...(reconnect.length > 0 ? { reconnect } : {}),
    },
    ...(lastKey ? { select: lastKey } : {}),
    added,
  };
}
