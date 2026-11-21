import type { FlowNodeShape } from "@/features/diagram/model/component.types";
import {
  countNodes,
  type OutlineError,
  type OutlineExit,
  type OutlineItem,
  type OutlineNode,
  type ParsedOutline,
} from "./guided.outline.parse";

/**
 * Mermaid read as a guided journey (spec guided-mermaid-interchange): the
 * `swimlane-beta` / `flowchart` / `graph` family (top-level subgraphs are lanes)
 * and `journey` (tasks in order, lane = first actor). The graph becomes the
 * outline AST, so `buildOutline` adds it exactly as it adds an outline.
 *
 * A small line reader for the documented subset, not Mermaid's grammar: every
 * line is either read, ignored as styling/metadata, or reported.
 */

const HEADER = /^(swimlane-beta|flowchart|graph|journey)\b/;
const IGNORED =
  /^(classDef|class|style|linkStyle|click|accTitle|accDescr|title|direction)\b|^accDescr\s*\{/;

/** The block's lines with their 1-based numbers: fences, front matter and comments removed. */
function meaningfulLines(text: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  let inFrontMatter = false;
  let seenContent = false;
  let inAccBlock = false;
  text.split(/\r?\n/).forEach((raw, index) => {
    const trimmed = raw.trim();
    if (/^```/.test(trimmed)) return;
    if (trimmed === "---" && (!seenContent || inFrontMatter)) {
      inFrontMatter = !inFrontMatter;
      return;
    }
    if (inFrontMatter) return;
    if (inAccBlock) {
      if (trimmed.includes("}")) inAccBlock = false;
      return;
    }
    const content = trimmed.replace(/%%.*$/, "").trim();
    if (!content) return;
    seenContent = true;
    if (/^accDescr\s*\{/.test(content) && !content.includes("}")) {
      inAccBlock = true;
      return;
    }
    out.push({ line: index + 1, text: content });
  });
  return out;
}

/** Whether `text` is a Mermaid block the guided capture reads. */
export function isMermaid(text: string): boolean {
  const first = meaningfulLines(text)[0];
  return !!first && HEADER.test(first.text);
}

// ─── Flowchart family ───────────────────────────────────────────────────────

interface MermaidNode {
  id: string;
  label: string | null;
  /** The shape opener as written: `[`, `(`, `((`, `{`, `@doc`, … */
  shape: string | null;
  lane: string | null;
  line: number;
}

interface MermaidEdge {
  source: string;
  target: string;
  label: string;
  line: number;
}

/** Shape openers and their closers, longest first. */
const SHAPES: Array<[string, string]> = [
  ["(((", ")))"],
  ["([", "])"],
  ["((", "))"],
  ["[(", ")]"],
  ["[[", "]]"],
  ["[/", "/]"],
  ["[\\", "\\]"],
  ["{{", "}}"],
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  [">", "]"],
];

const ID = /^[\p{L}\p{N}_][\p{L}\p{N}_.]*/u;
const TEXT_ARROW = /^\s*(?:--|==|-\.)\s+(?!>)(.+?)\s+(?:-{2,}>|-{3,}|={2,}>|={3,}|\.-+>|\.-+)\s*/;
const ARROW = /^\s*<?(?:-{2,}[>ox]?|={2,}[>ox=]?|-\.+-[>ox]?|~{3,})\s*/;
const PIPE_LABEL = /^\|([^|]*)\|\s*/;

const unquote = (text: string) => {
  const t = text.trim();
  return /^".*"$/.test(t) ? t.slice(1, -1).trim() : t;
};

/** `@{ shape: doc, label: "x" }` (Mermaid's expanded node syntax). */
function readShapeObject(body: string): { shape: string | null; label: string | null } {
  const shape = /shape\s*:\s*([\w-]+)/.exec(body)?.[1] ?? null;
  const label = /label\s*:\s*("([^"]*)"|[^,}]+)/.exec(body);
  return {
    shape: shape ? `@${shape}` : null,
    label: label ? (label[2] ?? label[1]!).trim() : null,
  };
}

interface Cursor {
  text: string;
  at: number;
}

/** A node reference at the cursor: `id`, `id[label]`, `id@{...}`; null when none. */
function readNode(cur: Cursor): { id: string; label: string | null; shape: string | null } | null {
  const rest = cur.text.slice(cur.at).replace(/^\s+/, "");
  cur.at = cur.text.length - rest.length;
  const id = ID.exec(rest)?.[0];
  if (!id) return null;
  let at = id.length;
  const after = rest.slice(at);
  if (after.startsWith("@{")) {
    const close = after.indexOf("}");
    if (close < 0) return null;
    cur.at += at + close + 1;
    return { id, ...readShapeObject(after.slice(2, close)) };
  }
  for (const [open, close] of SHAPES) {
    if (!after.startsWith(open)) continue;
    const inner = after.slice(open.length);
    let end: number;
    if (inner.trimStart().startsWith('"')) {
      const q = inner.indexOf('"');
      const q2 = inner.indexOf('"', q + 1);
      end = q2 < 0 ? -1 : inner.indexOf(close, q2 + 1);
    } else end = inner.indexOf(close);
    if (end < 0) return null;
    at += open.length + end + close.length;
    cur.at += at;
    return { id, label: unquote(inner.slice(0, end)), shape: open };
  }
  cur.at += at;
  return { id, label: null, shape: null };
}

/** `a & b` at the cursor. */
function readGroup(cur: Cursor) {
  const nodes = [];
  for (;;) {
    const node = readNode(cur);
    if (!node) return null;
    nodes.push(node);
    const amp = /^\s*&\s*/.exec(cur.text.slice(cur.at));
    if (!amp) return nodes;
    cur.at += amp[0].length;
  }
}

/** An arrow and its label at the cursor; null when none. `visible` is false for `~~~`. */
function readArrow(cur: Cursor): { label: string; visible: boolean } | null {
  const rest = cur.text.slice(cur.at);
  const textual = TEXT_ARROW.exec(rest);
  if (textual) {
    cur.at += textual[0].length;
    return { label: unquote(textual[1]!), visible: true };
  }
  const arrow = ARROW.exec(rest);
  if (!arrow) return null;
  cur.at += arrow[0].length;
  const pipe = PIPE_LABEL.exec(cur.text.slice(cur.at));
  if (pipe) cur.at += pipe[0].length;
  return { label: pipe ? unquote(pipe[1]!) : "", visible: !arrow[0].includes("~") };
}

/** The guided kind of a node by its shape and its place in the graph. */
function nodeShape(shape: string | null): {
  kind: "step" | "decision" | "round";
  flow?: FlowNodeShape;
} {
  switch (shape) {
    case "{":
    case "{{":
    case "@diam":
    case "@diamond":
    case "@decision":
    case "@question":
    case "@hex":
    case "@hexagon":
      return { kind: "decision" };
    case "[(":
    case "@cyl":
    case "@cylinder":
    case "@database":
    case "@db":
      return { kind: "step", flow: "cylinder" };
    case "[[":
    case "@subproc":
    case "@subprocess":
    case "@subroutine":
    case "@fr-rect":
      return { kind: "step", flow: "subroutine" };
    case "@doc":
    case "@document":
      return { kind: "step", flow: "document" };
    case "@event":
      return { kind: "step", flow: "event" };
    case "((":
    case "(((":
    case "([":
    case "@circle":
    case "@circ":
    case "@start":
    case "@sm-circ":
    case "@stadium":
    case "@pill":
    case "@terminal":
    case "@stop":
    case "@fr-circ":
    case "@dbl-circ":
      return { kind: "round" };
    default:
      return { kind: "step" };
  }
}

function parseFlowchart(lines: Array<{ line: number; text: string }>): ParsedOutline {
  const errors: OutlineError[] = [];
  const nodes = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  const lanes: string[] = [];
  const stack: Array<{ line: number; lane: string }> = [];

  const mention = (
    ref: { id: string; label: string | null; shape: string | null },
    line: number,
  ) => {
    const lane = stack[0]?.lane ?? null;
    const known = nodes.get(ref.id);
    if (!known) {
      nodes.set(ref.id, { id: ref.id, label: ref.label, shape: ref.shape, lane, line });
      return;
    }
    if (ref.label !== null && known.label === null) known.label = ref.label;
    if (ref.shape !== null && known.shape === null) known.shape = ref.shape;
    // A node stays in the first lane that lists it.
    if (known.lane === null && lane !== null) known.lane = lane;
  };

  for (const { line, text } of lines.slice(1)) {
    for (const statement of text.split(";")) {
      const st = statement.trim();
      if (!st || IGNORED.test(st)) continue;
      const sub = /^subgraph\b\s*(.*)$/.exec(st);
      if (sub) {
        const rest = sub[1]!.trim();
        const bracket = /^[^\s[]+\s*\[(.*)\]$/.exec(rest);
        const name = unquote(bracket ? bracket[1]! : rest) || `Lane ${lanes.length + 1}`;
        if (stack.length === 0 && !lanes.some((l) => l.toLowerCase() === name.toLowerCase()))
          lanes.push(name);
        stack.push({ line, lane: stack[0]?.lane ?? name });
        continue;
      }
      if (st === "end") {
        if (stack.length === 0) errors.push({ line, code: "mermaidStrayEnd" });
        else stack.pop();
        continue;
      }
      const cur: Cursor = { text: st, at: 0 };
      let from = readGroup(cur);
      if (!from) {
        errors.push({ line, code: "mermaidUnreadable" });
        continue;
      }
      from.forEach((ref) => mention(ref, line));
      let ok = true;
      while (cur.at < st.length && st.slice(cur.at).trim()) {
        const arrow = readArrow(cur);
        const to = arrow ? readGroup(cur) : null;
        if (!arrow || !to) {
          ok = false;
          break;
        }
        to.forEach((ref) => mention(ref, line));
        if (arrow.visible)
          for (const a of from)
            for (const b of to)
              edges.push({ source: a.id, target: b.id, label: arrow.label, line });
        from = to;
      }
      if (!ok) errors.push({ line, code: "mermaidUnreadable" });
    }
  }
  for (const open of stack) errors.push({ line: open.line, code: "mermaidUnclosedSubgraph" });
  if (errors.length === 0 && nodes.size === 0)
    errors.push({ line: lines[0]?.line ?? 1, code: "mermaidEmpty" });
  if (errors.length > 0) return { items: [], errors, lanes: [], nodeCount: 0 };

  const items = toOutline([...nodes.values()], edges);
  return { items, errors, lanes, nodeCount: countNodes(items) };
}

/** The graph as the outline AST: a depth-first walk from the entries, revisits as jumps. */
function toOutline(nodes: MermaidNode[], edges: MermaidEdge[]): OutlineItem[] {
  const outgoing = new Map<string, MermaidEdge[]>();
  const incoming = new Map<string, number>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const isStart = (n: MermaidNode) =>
    nodeShape(n.shape).kind === "round" && !incoming.get(n.id) && !!outgoing.get(n.id)?.length;
  const visited = new Set<string>();

  const itemFor = (n: MermaidNode): OutlineNode => {
    const shape = nodeShape(n.shape);
    const outs = outgoing.get(n.id) ?? [];
    // Where the path splits is a decision in the journey, whatever box Mermaid drew.
    const kind =
      shape.kind === "decision" || (outs.length > 1 && !shape.flow)
        ? "decision"
        : shape.kind === "round" && outs.length === 0
          ? "end"
          : "step";
    return {
      kind,
      line: n.line,
      name: n.label ?? n.id,
      lane: n.lane,
      exits: [],
      ref: n.id,
      ...(shape.flow && { shape: shape.flow }),
    };
  };

  const emit = (id: string): OutlineItem[] => {
    const seq: OutlineItem[] = [];
    let at = id;
    for (;;) {
      const node = byId.get(at)!;
      if (visited.has(at)) {
        seq.push({ kind: "jump", line: node.line, target: node.label ?? node.id, ref: at });
        return seq;
      }
      visited.add(at);
      const item = itemFor(node);
      seq.push(item);
      const outs = outgoing.get(at) ?? [];
      if (item.kind === "end" || outs.length === 0) return seq;
      if (outs.length === 1 && !outs[0]!.label && item.kind !== "decision") {
        at = outs[0]!.target;
        continue;
      }
      item.exits = outs.map((edge): OutlineExit => ({
        line: edge.line,
        label: edge.label,
        body: emit(edge.target),
      }));
      return seq;
    }
  };

  /** The entries' first edges, a start's edges standing in for it (no second start). */
  const entryExits = (entries: MermaidNode[]): OutlineExit[] =>
    entries.flatMap((n) => {
      if (isStart(n)) {
        visited.add(n.id);
        return (outgoing.get(n.id) ?? []).map((edge) => ({
          line: edge.line,
          label: edge.label,
          body: emit(edge.target),
        }));
      }
      return visited.has(n.id) ? [] : [{ line: n.line, label: "", body: emit(n.id) }];
    });

  const exits = entryExits(nodes.filter((n) => !incoming.get(n.id)));
  // Cycles no entry reaches: start from their first declared node.
  for (const n of nodes) if (!visited.has(n.id)) exits.push(...entryExits([n]));
  const first = exits[0];
  if (exits.length === 1 && first && !first.label) return first.body;
  return [{ kind: "fanout", line: first?.line ?? 1, exits }];
}

// ─── Journey ────────────────────────────────────────────────────────────────

function parseJourney(lines: Array<{ line: number; text: string }>): ParsedOutline {
  const errors: OutlineError[] = [];
  const items: OutlineItem[] = [];
  const lanes: string[] = [];
  let sections = 0;
  let scores = 0;
  let lane: string | null = null;
  for (const { line, text } of lines.slice(1)) {
    if (/^title\b/.test(text) || IGNORED.test(text)) continue;
    if (/^section\b/.test(text)) {
      sections += 1;
      continue;
    }
    const task = /^(.+?)\s*:\s*([^:]*?)\s*(?::\s*(.*))?$/.exec(text);
    if (!task || !task[2]) {
      errors.push({ line, code: "mermaidTaskWithoutScore" });
      continue;
    }
    const score = Number(task[2]);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      errors.push({ line, code: "mermaidScoreOutOfRange", values: { score: task[2] } });
      continue;
    }
    scores += 1;
    const actor =
      (task[3] ?? "")
        .split(",")
        .map((a) => a.trim())
        .find(Boolean) ?? null;
    if (actor && !lanes.some((l) => l.toLowerCase() === actor.toLowerCase())) lanes.push(actor);
    // A task without actors stays with the one before it.
    lane = actor ?? lane;
    items.push({ kind: "step", line, name: task[1]!.trim(), lane, exits: [] });
  }
  if (errors.length === 0 && items.length === 0)
    errors.push({ line: lines[0]?.line ?? 1, code: "mermaidEmpty" });
  if (errors.length > 0) return { items: [], errors, lanes: [], nodeCount: 0 };
  return { items, errors, lanes, nodeCount: items.length, setAside: { sections, scores } };
}

/** A Mermaid block as the outline AST; check `isMermaid` first. */
export function parseMermaid(text: string): ParsedOutline {
  const lines = meaningfulLines(text);
  const header = HEADER.exec(lines[0]?.text ?? "")?.[1];
  return header === "journey" ? parseJourney(lines) : parseFlowchart(lines);
}
