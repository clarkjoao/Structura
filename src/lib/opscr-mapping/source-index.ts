import { connectionKeys } from "./importer-graph";
import { nodeId } from "./technical-view";
import type { OpscrManifestInput, TechnicalView } from "./types";

/**
 * A manifest and where it came from — what an `opscr/core` `Manifest` carries (`sourceFile`,
 * the 1-based `line` it starts on, the 1-based line of each `spec.edges` entry).
 */
export interface LocatedManifestInput extends OpscrManifestInput {
  sourceFile: string;
  line: number;
  edgeLines: ReadonlyMap<number, number>;
}

/** A line of a file, 1-based. */
export interface SourceLocation {
  file: string;
  line: number;
}

/**
 * An element of the drawn graph by its importer-graph key: a component's `key` (`Kind/name`), or
 * a connection's key from `connectionKeys` — the ids the embed preview gives them.
 */
export interface GraphElementRef {
  kind: "component" | "connection";
  key: string;
}

/** A line where something starts, and what is drawn for it (null: nothing). */
interface Mark {
  line: number;
  element: GraphElementRef | null;
}

/**
 * Where each drawn element is written, and which element a line of YAML writes — so a host can
 * jump from the picture to the YAML and back. Built from the manifests the view was built from.
 */
export class SourceIndex {
  private readonly locations = new Map<string, SourceLocation>();
  /** Per file, the lines where a manifest or an edge starts, in order. */
  private readonly marks = new Map<string, Mark[]>();
  /** Every manifest by `Kind/name`, and every edge by `relationship#index`, drawn or not. */
  private readonly written = new Map<string, SourceLocation>();

  constructor(manifests: readonly LocatedManifestInput[], view: TechnicalView) {
    const drawn = new Set(view.nodes.map((n) => n.id));
    const byId = new Map<string, LocatedManifestInput>();
    for (const m of manifests) {
      const id = nodeId(m.kind, m.metadata.name);
      // Duplicate names are a compile error; the first wins, as in the view.
      if (!byId.has(id)) byId.set(id, m);
    }

    const keyOfEdge = new Map<string, string>();
    const keys = connectionKeys(
      view.edges.map((e) => ({ source: e.sourceId, target: e.targetId, label: e.type })),
    );
    view.edges.forEach((edge, i) => keyOfEdge.set(edge.id, keys[i]!));

    /** `writes`: the element is written here (not just placed, as a belongsTo places its child). */
    const mark = (file: string, line: number, element: GraphElementRef | null, writes = true) => {
      const list = this.marks.get(file) ?? [];
      list.push({ line, element });
      this.marks.set(file, list);
      if (element && writes) this.locations.set(refId(element), { file, line });
    };

    for (const m of manifests) {
      const id = nodeId(m.kind, m.metadata.name);
      const first = byId.get(id) === m;
      if (first) this.written.set(id, { file: m.sourceFile, line: m.line });
      mark(m.sourceFile, m.line, first && drawn.has(id) ? { kind: "component", key: id } : null);
      if (!first || m.kind !== "Relationship") continue;
      const edges = m.spec["edges"];
      if (!Array.isArray(edges)) continue;
      edges.forEach((edge: unknown, index) => {
        const line = m.edgeLines.get(index);
        if (line === undefined) return;
        this.written.set(`${m.metadata.name}#${index}`, { file: m.sourceFile, line });
        const key = keyOfEdge.get(`${m.metadata.name}#${index}`);
        // A drawn edge is its connection; a belongsTo is drawn as its child's place.
        const child = belongsToChild(edge);
        if (key) mark(m.sourceFile, line, { kind: "connection", key });
        else if (child && drawn.has(child)) {
          mark(m.sourceFile, line, { kind: "component", key: child }, false);
        } else mark(m.sourceFile, line, null);
      });
    }
    for (const list of this.marks.values()) list.sort((a, b) => a.line - b.line);
  }

  /** Where the element is written: its manifest's first line, or its edge's. */
  locate(element: GraphElementRef): SourceLocation | undefined {
    return this.locations.get(refId(element));
  }

  /** Where a manifest (`Kind/name`) or a Relationship edge (`relationship#index`) is written. */
  locateWritten(id: string): SourceLocation | undefined {
    return this.written.get(id);
  }

  /** The drawn element whose manifest or edge `line` of `file` is in, if any. */
  elementAt(file: string, line: number): GraphElementRef | null {
    const list = this.marks.get(file);
    if (!list) return null;
    let found: Mark | undefined;
    for (const mark of list) {
      if (mark.line > line) break;
      found = mark;
    }
    return found?.element ?? null;
  }
}

const refId = (element: GraphElementRef) => `${element.kind}:${element.key}`;

/** The element a `belongsTo` edge places, as a node id; null for other edges. */
function belongsToChild(edge: unknown): string | null {
  if (typeof edge !== "object" || edge === null) return null;
  const e = edge as Record<string, unknown>;
  if (e["type"] !== "belongsTo") return null;
  const from = e["from"] as Record<string, unknown> | undefined;
  return typeof from?.["kind"] === "string" && typeof from["id"] === "string"
    ? nodeId(from["kind"], from["id"])
    : null;
}
