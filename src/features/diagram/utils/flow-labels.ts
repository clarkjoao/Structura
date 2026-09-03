import type { Flow } from "../model/flow.types";
import { getFlowOutEdges, getReachableStepIds, type FlowEdge } from "./flow-graph";

/**
 * A join whose label could not be derived from a single branch point, because
 * the incoming chains close at more than one position of the same sequence.
 * The label is still assigned deterministically (the latest closing position
 * wins), and the case is reported so callers can surface it.
 */
export interface FlowLabelAmbiguity {
  stepId: string;
  /** Labels of the competing closing positions, in sequence order. */
  closingLabels: string[];
  chosenLabel: string;
}

export interface FlowLabelResult {
  /** stepId → hierarchical label, for every reachable step. */
  labels: Record<string, string>;
  /** Reachable step ids sorted by their label. */
  order: string[];
  /** Steps with no label: unreachable ones, plus anything caught in a cycle. */
  unlabeled: string[];
  ambiguities: FlowLabelAmbiguity[];
  /**
   * Labels assigned to more than one step. Reachable only through the
   * base-26 extension of the branch letters (a condition with 27+ branches
   * can produce `1aa`, which is also the first branch of branch `1a`), and
   * reported rather than silently resolved.
   */
  collisions: string[];
}

/** Sequence context: the main path, or the inside of one branch. */
interface LabelContext {
  parent: LabelContext | null;
  /** Prefix ordinals are appended to. `""` for the main sequence, `"3a."` inside a branch. */
  prefix: string;
  /** Step that opened this context. `null` for the main sequence. */
  branchPointId: string | null;
}

interface StepLabelInfo {
  label: string;
  context: LabelContext;
  /** Position within `context`. The main sequence starts at 1; a branch head is 0. */
  ordinal: number;
}

/** 0 → "a", 25 → "z", 26 → "aa" — bijective base-26, so every branch gets a distinct letter. */
export function branchLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    out = String.fromCharCode(97 + remainder) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

interface LabelSegment {
  ordinal: number;
  letter: string;
}

function parseLabel(label: string): LabelSegment[] {
  return label.split(".").map((raw) => {
    const match = /^(\d+)([a-z]*)$/.exec(raw);
    if (!match) return { ordinal: Number.NaN, letter: raw };
    return { ordinal: Number(match[1]), letter: match[2] ?? "" };
  });
}

/** Orders labels the way the reader walks them: `3` < `3a` < `3a.1` < `3b` < `4`. */
export function compareFlowStepLabels(a: string, b: string): number {
  const left = parseLabel(a);
  const right = parseLabel(b);
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i++) {
    const l = left[i]!;
    const r = right[i]!;
    if (l.ordinal !== r.ordinal) return l.ordinal - r.ordinal;
    if (l.letter !== r.letter) return l.letter < r.letter ? -1 : 1;
  }
  return left.length - right.length;
}

function contextChain(context: LabelContext): LabelContext[] {
  const chain: LabelContext[] = [];
  let cursor: LabelContext | null = context;
  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parent;
  }
  return chain;
}

/** Deepest context that is an ancestor-or-self of every context given. */
function lowestCommonContext(contexts: LabelContext[]): LabelContext {
  const chains = contexts.map(contextChain);
  const first = chains[0]!;
  let best = first[0]!;
  for (let depth = 0; depth < first.length; depth++) {
    const candidate = first[depth]!;
    if (chains.every((chain) => chain[depth] === candidate)) best = candidate;
    else break;
  }
  return best;
}

/**
 * Hierarchical numbering of a flow graph.
 *
 * The main path counts `1, 2, 3, …` from `entryStepId`. Each branch of a
 * condition takes a letter in the order declared in `branches[]` (`3a`, `3b`),
 * and steps inside a branch are dotted (`3a.1`, `3a.2`); nesting repeats the
 * pattern (`3a.2b`, `3a.2b.1`). Where branches reconverge, the meeting step
 * returns to the enclosing sequence at the position after the branch point.
 *
 * The label is derived, never stored: nothing here writes to the flow.
 */
export function computeFlowStepLabels(flow: Flow): FlowLabelResult {
  const empty: FlowLabelResult = {
    labels: {},
    order: [],
    unlabeled: Object.keys(flow.steps).sort(),
    ambiguities: [],
    collisions: [],
  };

  const entry = flow.entryStepId;
  if (!entry || !flow.steps[entry]) return empty;

  const reachable = getReachableStepIds(flow);
  const reachableSet = new Set(reachable);

  const incoming = new Map<string, FlowEdge[]>();
  const outgoing = new Map<string, FlowEdge[]>();
  for (const id of reachable) {
    const edges = getFlowOutEdges(flow, id).filter((edge) => reachableSet.has(edge.to));
    outgoing.set(id, edges);
    for (const edge of edges) {
      const list = incoming.get(edge.to);
      if (list) list.push(edge);
      else incoming.set(edge.to, [edge]);
    }
  }

  const mainContext: LabelContext = { parent: null, prefix: "", branchPointId: null };
  const info = new Map<string, StepLabelInfo>();
  const ambiguities: FlowLabelAmbiguity[] = [];

  const pending = new Map<string, number>();
  for (const id of reachable) pending.set(id, (incoming.get(id) ?? []).length);

  const resolve = (id: string): StepLabelInfo => {
    if (id === entry) {
      return { label: "1", context: mainContext, ordinal: 1 };
    }

    const edges = incoming.get(id) ?? [];

    if (edges.length === 1) {
      const edge = edges[0]!;
      const from = info.get(edge.from)!;
      if (edge.branchIndex !== undefined) {
        const label = `${from.label}${branchLetter(edge.branchIndex)}`;
        return {
          label,
          context: { parent: from.context, prefix: `${label}.`, branchPointId: edge.from },
          ordinal: 0,
        };
      }
      const ordinal = from.ordinal + 1;
      return { label: `${from.context.prefix}${ordinal}`, context: from.context, ordinal };
    }

    // A join. Each incoming chain closes at some position of a shared sequence:
    // a chain coming out of a branch closes at that branch point, and a chain
    // arriving directly closes at its own predecessor. The join resumes the
    // sequence right after the last of those positions.
    const common = lowestCommonContext(edges.map((edge) => info.get(edge.from)!.context));
    const closings = new Map<number, string>();
    for (const edge of edges) {
      const from = info.get(edge.from)!;
      if (from.context === common) {
        closings.set(from.ordinal, from.label);
        continue;
      }
      let cursor = from.context;
      while (cursor.parent && cursor.parent !== common) cursor = cursor.parent;
      const branchPoint = info.get(cursor.branchPointId!)!;
      closings.set(branchPoint.ordinal, branchPoint.label);
    }

    const ordinals = [...closings.keys()].sort((a, b) => a - b);
    const ordinal = ordinals[ordinals.length - 1]! + 1;
    const label = `${common.prefix}${ordinal}`;

    if (ordinals.length > 1) {
      ambiguities.push({
        stepId: id,
        closingLabels: ordinals.map((value) => closings.get(value)!),
        chosenLabel: label,
      });
    }

    return { label, context: common, ordinal };
  };

  const queue: string[] = [entry];
  pending.set(entry, 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    info.set(id, resolve(id));
    for (const edge of outgoing.get(id) ?? []) {
      const left = (pending.get(edge.to) ?? 0) - 1;
      pending.set(edge.to, left);
      if (left === 0 && !info.has(edge.to)) queue.push(edge.to);
    }
  }

  const labels: Record<string, string> = {};
  for (const [id, entryInfo] of info) labels[id] = entryInfo.label;

  const order = [...info.keys()].sort((a, b) => compareFlowStepLabels(labels[a]!, labels[b]!));
  const unlabeled = Object.keys(flow.steps)
    .filter((id) => !info.has(id))
    .sort();

  const seen = new Map<string, number>();
  for (const label of Object.values(labels)) seen.set(label, (seen.get(label) ?? 0) + 1);
  const collisions = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([label]) => label)
    .sort(compareFlowStepLabels);

  return { labels, order, unlabeled, ambiguities, collisions };
}
