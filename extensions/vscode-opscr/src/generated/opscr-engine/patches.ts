/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Copy of the opscr plugin's src/engine (+ project.ts, plugin types), synced via `npm run sync-shared`.
 * Edit the source files and re-sync instead of changing this file.
 */

import {
  appendDocument,
  appendSeqItem,
  applyEdits,
  cutDocument,
  cutSeqItem,
  documentSource,
  isMap,
  isSeq,
  parseDocuments,
  replaceDocument,
  renderScalar,
  replaceScalar,
  scalarAt,
  setMapValue,
  type ParsedDocument,
  type TextEdit,
} from "./yaml-text";

/**
 * Workspace-level patches of opscr manifests, by element key (`Kind/name`) and edge. Each
 * takes the manifest files and returns new ones, touching only the text it changes; null
 * means the patch does not apply (unknown element, unsupported layout, unparsable file).
 */

export interface SourceText {
  name: string;
  text: string;
}

export interface ElementRef {
  kind: string;
  name: string;
}

/** One Relationship edge, as written — enough to find it again or write it back. */
export interface EdgeSource {
  relationship: string;
  file: string;
  from: ElementRef;
  to: ElementRef;
  type: string;
  description?: string;
}

/** The edge types opscr's Relationship schema accepts. */
export const EDGE_TYPES: ReadonlySet<string> = new Set([
  "calls",
  "consumes",
  "produces",
  "reads",
  "writes",
  "subscribes",
  "publishes",
  "triggers",
  "appliesTo",
  "belongsTo",
  "relatedTo",
]);

export const keyOf = (ref: ElementRef) => `${ref.kind}/${ref.name}`;
export function refOf(key: string): ElementRef {
  const slash = key.indexOf("/");
  return { kind: key.slice(0, slash), name: key.slice(slash + 1) };
}
const same = (a: ElementRef, b: ElementRef) => a.kind === b.kind && a.name === b.name;

interface Parsed {
  file: SourceText;
  docs: ParsedDocument[];
}

function parseAll(files: readonly SourceText[]): Parsed[] | null {
  const parsed: Parsed[] = [];
  for (const file of files) {
    const docs = parseDocuments(file.text);
    if (!docs) return null;
    parsed.push({ file, docs });
  }
  return parsed;
}

const kindOf = (doc: ParsedDocument) => scalarAt(doc.contents, "kind")?.value;
const nameNode = (doc: ParsedDocument) => scalarAt(doc.getIn(["metadata"], true), "name");

function endRef(node: unknown): ElementRef | null {
  const kind = scalarAt(node, "kind")?.value;
  const id = scalarAt(node, "id")?.value;
  return typeof kind === "string" && typeof id === "string" ? { kind, name: id } : null;
}

interface FoundEdge {
  at: number;
  doc: number;
  item: number;
  source: EdgeSource;
}

/** Every well-formed edge in workspace order (files, then documents, then items). */
function edgesOf(parsed: readonly Parsed[]): FoundEdge[] {
  return parsed.flatMap(({ file, docs }, at) =>
    docs.flatMap((doc, d) => {
      if (kindOf(doc) !== "Relationship") return [];
      const relationship = nameNode(doc)?.value;
      const edges = doc.getIn(["spec", "edges"], true);
      if (typeof relationship !== "string" || !isSeq(edges)) return [];
      return edges.items.flatMap((item, i): FoundEdge[] => {
        const from = endRef(isMap(item) ? item.get("from", true) : null);
        const to = endRef(isMap(item) ? item.get("to", true) : null);
        const type = scalarAt(item, "type")?.value;
        if (!from || !to || typeof type !== "string") return [];
        const description = scalarAt(item, "description")?.value;
        return [
          {
            at,
            doc: d,
            item: i,
            source: {
              relationship,
              file: file.name,
              from,
              to,
              type,
              ...(typeof description === "string" ? { description } : {}),
            },
          },
        ];
      });
    }),
  );
}

function findManifest(parsed: readonly Parsed[], ref: ElementRef) {
  for (const [at, { docs }] of parsed.entries()) {
    const doc = docs.findIndex((d) => kindOf(d) === ref.kind && nameNode(d)?.value === ref.name);
    if (doc >= 0) return { at, doc };
  }
  return null;
}

export function hasManifest(files: readonly SourceText[], ref: ElementRef): boolean {
  const parsed = parseAll(files);
  return !!parsed && findManifest(parsed, ref) !== null;
}

/** Edits grouped by file index → new file list. */
function commit(files: readonly SourceText[], edits: Map<number, TextEdit[]>): SourceText[] {
  return files.map((file, at) => {
    const list = edits.get(at);
    return list?.length ? { ...file, text: applyEdits(file.text, list) } : file;
  });
}

function push(edits: Map<number, TextEdit[]>, at: number, edit: TextEdit) {
  edits.set(at, [...(edits.get(at) ?? []), edit]);
}

/** Renames an element and every edge end naming it. Null when unknown or `to` is taken. */
export function renameElement(
  files: readonly SourceText[],
  ref: ElementRef,
  to: string,
): SourceText[] | null {
  const parsed = parseAll(files);
  if (!parsed || findManifest(parsed, { kind: ref.kind, name: to })) return null;
  const found = findManifest(parsed, ref);
  const name = found && nameNode(parsed[found.at]!.docs[found.doc]!);
  if (!found || !name) return null;
  const edits = new Map<number, TextEdit[]>();
  push(edits, found.at, replaceScalar(name, to));
  for (const edge of edgesOf(parsed)) {
    const item = parsed[edge.at]!.docs[edge.doc]!.getIn(["spec", "edges", edge.item], true);
    for (const end of ["from", "to"] as const) {
      if (!same(edge.source[end], ref) || !isMap(item)) continue;
      const id = scalarAt(item.get(end, true), "id");
      if (id) push(edits, edge.at, replaceScalar(id, to));
    }
  }
  return commit(files, edits);
}

/** Sets `spec.description`. */
export function setDescription(
  files: readonly SourceText[],
  ref: ElementRef,
  description: string,
): SourceText[] | null {
  return setSpecField(files, ref, "description", description);
}

/** Sets a scalar field of `spec` (in place, or as a new line in the spec's indentation). */
export function setSpecField(
  files: readonly SourceText[],
  ref: ElementRef,
  field: string,
  value: string,
): SourceText[] | null {
  const parsed = parseAll(files);
  const found = parsed && findManifest(parsed, ref);
  if (!parsed || !found) return null;
  const { file, docs } = parsed[found.at]!;
  const spec = docs[found.doc]!.get("spec", true);
  const edit = isMap(spec) ? setMapValue(file.text, spec, field, value) : null;
  return edit ? commit(files, new Map([[found.at, [edit]]])) : null;
}

/**
 * Cuts edges, and the Relationships they leave empty (opscr requires at least one edge).
 * Edits are computed on the original text, so they never overlap.
 */
function cutEdges(
  parsed: readonly Parsed[],
  cut: readonly FoundEdge[],
  edits: Map<number, TextEdit[]>,
) {
  const byDoc = new Map<string, FoundEdge[]>();
  for (const edge of cut) {
    const id = `${edge.at}:${edge.doc}`;
    byDoc.set(id, [...(byDoc.get(id) ?? []), edge]);
  }
  for (const list of byDoc.values()) {
    const { at, doc } = list[0]!;
    const { file, docs } = parsed[at]!;
    const seq = docs[doc]!.getIn(["spec", "edges"], true);
    if (!isSeq(seq)) return false;
    if (list.length === seq.items.length) {
      push(edits, at, cutDocument(file.text, docs, doc));
      continue;
    }
    for (const edge of list) {
      const edit = cutSeqItem(file.text, seq, edge.item);
      if (!edit) return false;
      push(edits, at, edit);
    }
  }
  return true;
}

export interface RemovedElement {
  files: SourceText[];
  /** The manifest's file and source, and the edges that named it — to restore it later. */
  file: string;
  source: string;
  edges: EdgeSource[];
}

/** Removes elements' manifests and every edge naming any of them, in one patch. */
export function removeElements(
  files: readonly SourceText[],
  refs: readonly ElementRef[],
): { files: SourceText[]; removed: Map<string, Omit<RemovedElement, "files">> } | null {
  const parsed = parseAll(files);
  if (!parsed) return null;
  const edits = new Map<number, TextEdit[]>();
  const removed = new Map<string, Omit<RemovedElement, "files">>();
  const found = refs.flatMap((ref) => {
    const at = findManifest(parsed, ref);
    return at ? [{ ref, ...at }] : [];
  });
  const edges = edgesOf(parsed);
  const cut = edges.filter((e) =>
    found.some(({ ref }) => same(e.source.from, ref) || same(e.source.to, ref)),
  );
  for (const { ref, at, doc } of found) {
    const { file, docs } = parsed[at]!;
    push(edits, at, cutDocument(file.text, docs, doc));
    removed.set(keyOf(ref), {
      file: file.name,
      source: documentSource(file.text, docs[doc]!),
      edges: cut
        .filter((e) => same(e.source.from, ref) || same(e.source.to, ref))
        .map((e) => e.source),
    });
  }
  if (!cutEdges(parsed, cut, edits)) return null;
  return { files: commit(files, edits), removed };
}

/** The source of an element's manifest and the edges naming it, without changing anything. */
export function elementSource(
  files: readonly SourceText[],
  ref: ElementRef,
): Omit<RemovedElement, "files"> | null {
  const parsed = parseAll(files);
  const found = parsed && findManifest(parsed, ref);
  if (!parsed || !found) return null;
  const { file, docs } = parsed[found.at]!;
  return {
    file: file.name,
    source: documentSource(file.text, docs[found.doc]!),
    edges: edgesOf(parsed)
      .filter((e) => same(e.source.from, ref) || same(e.source.to, ref))
      .map((e) => e.source),
  };
}

/** An edge as the canvas keys it: ends, type and its index among equal edges. */
export interface EdgeMatch {
  from: ElementRef;
  to: ElementRef;
  type: string;
  n: number;
}

const matches = (e: EdgeSource, m: Omit<EdgeMatch, "n">) =>
  same(e.from, m.from) && same(e.to, m.to) && e.type === m.type;

function findEdge(parsed: readonly Parsed[], match: EdgeMatch): FoundEdge | null {
  return edgesOf(parsed).filter((e) => matches(e.source, match))[match.n] ?? null;
}

/** How many edges with these ends and type there are — the `n` a new one would get. */
export function countEdges(files: readonly SourceText[], match: Omit<EdgeMatch, "n">): number {
  const parsed = parseAll(files);
  return parsed ? edgesOf(parsed).filter((e) => matches(e.source, match)).length : 0;
}

export function edgeSource(files: readonly SourceText[], match: EdgeMatch): EdgeSource | null {
  const parsed = parseAll(files);
  return (parsed && findEdge(parsed, match)?.source) ?? null;
}

export function removeEdge(
  files: readonly SourceText[],
  match: EdgeMatch,
): { files: SourceText[]; edge: EdgeSource } | null {
  const parsed = parseAll(files);
  const found = parsed && findEdge(parsed, match);
  if (!parsed || !found) return null;
  const edits = new Map<number, TextEdit[]>();
  if (!cutEdges(parsed, [found], edits)) return null;
  return { files: commit(files, edits), edge: found.source };
}

export function setEdgeType(
  files: readonly SourceText[],
  match: EdgeMatch,
  type: string,
): SourceText[] | null {
  const parsed = parseAll(files);
  const found = parsed && findEdge(parsed, match);
  if (!parsed || !found) return null;
  const item = parsed[found.at]!.docs[found.doc]!.getIn(["spec", "edges", found.item], true);
  const node = scalarAt(item, "type");
  return node ? commit(files, new Map([[found.at, [replaceScalar(node, type)]]])) : null;
}

/** A flow-map scalar: plain when nothing in it would end or open a flow collection. */
const flowScalar = (value: string) => {
  const rendered = renderScalar(value);
  return /[,{}[\]]/.test(rendered) && !rendered.startsWith('"') ? JSON.stringify(value) : rendered;
};
const flowEnd = (ref: ElementRef) =>
  `{ kind: ${flowScalar(ref.kind)}, id: ${flowScalar(ref.name)} }`;

function edgeLines(edge: Omit<EdgeSource, "relationship" | "file">): string[] {
  return [
    `from: ${flowEnd(edge.from)}`,
    `to: ${flowEnd(edge.to)}`,
    `type: ${renderScalar(edge.type)}`,
    ...(edge.description !== undefined ? [`description: ${JSON.stringify(edge.description)}`] : []),
  ];
}

/**
 * Adds an edge: to `relationship` when it exists, else to the Relationship already holding a
 * flow edge from the source, else one naming the source, else one holding edges of the same
 * type into the target, else one naming the target, else to a new Relationship
 * `<source>-relationships` in the source's file (or the first file).
 */
export function addEdge(
  files: readonly SourceText[],
  edge: Omit<EdgeSource, "relationship" | "file">,
  relationship?: string,
): SourceText[] | null {
  const parsed = parseAll(files);
  if (!parsed || files.length === 0) return null;
  const edges = edgesOf(parsed);
  const target =
    edges.find((e) => e.source.relationship === relationship) ??
    edges.find((e) => same(e.source.from, edge.from) && e.source.type !== "belongsTo") ??
    edges.find((e) => same(e.source.from, edge.from) || same(e.source.to, edge.from)) ??
    // A new element: next to the edges of the same type into its target (its siblings'
    // belongsTo), else any edge naming the target.
    edges.find((e) => same(e.source.to, edge.to) && e.source.type === edge.type) ??
    edges.find((e) => same(e.source.from, edge.to) || same(e.source.to, edge.to));
  if (target) {
    const { file, docs } = parsed[target.at]!;
    const seq = docs[target.doc]!.getIn(["spec", "edges"], true);
    const edit = isSeq(seq) ? appendSeqItem(file.text, seq, edgeLines(edge)) : null;
    if (edit) return commit(files, new Map([[target.at, [edit]]]));
  }
  const home = findManifest(parsed, edge.from)?.at ?? 0;
  const taken = new Set(edges.map((e) => e.source.relationship));
  let name = relationship ?? `${edge.from.name}-relationships`;
  for (let i = 2; taken.has(name); i++) name = `${edge.from.name}-relationships-${i}`;
  const doc = [
    "apiVersion: opscr.dev/v1",
    "kind: Relationship",
    "metadata:",
    `  name: ${name}`,
    "spec:",
    "  edges:",
    ...edgeLines(edge).map((line, i) => (i === 0 ? "    - " : "      ") + line),
  ].join("\n");
  return files.map((file, at) =>
    at === home ? { ...file, text: appendDocument(file.text, doc) } : file,
  );
}

/** Puts a removed manifest back at the end of its file (or the first file). */
export function restoreElement(
  files: readonly SourceText[],
  removed: { file: string; source: string },
): SourceText[] {
  const home = Math.max(
    0,
    files.findIndex((f) => f.name === removed.file),
  );
  return files.map((file, at) =>
    at === home ? { ...file, text: appendDocument(file.text, removed.source) } : file,
  );
}

/** Whether the workspace already has this edge (same ends and type). */
export function hasEdge(files: readonly SourceText[], edge: Omit<EdgeMatch, "n">): boolean {
  return countEdges(files, edge) > 0;
}

/** A name the editor can rename (F2): a manifest's `metadata.name`, or an edge end's `id`. */
export interface NameAt {
  ref: ElementRef;
  start: number;
  end: number;
}

/** The renameable name at `offset` in file `fileName` (the cursor may sit right after it). */
export function nameAt(
  files: readonly SourceText[],
  fileName: string,
  offset: number,
): NameAt | null {
  const file = files.find((f) => f.name === fileName);
  const docs = file && parseDocuments(file.text);
  if (!docs) return null;
  const within = (node: { range?: [number, number, number] | null } | null) =>
    !!node?.range && node.range[0] <= offset && offset <= node.range[1];
  for (const doc of docs) {
    const kind = kindOf(doc);
    const name = nameNode(doc);
    if (typeof kind === "string" && typeof name?.value === "string" && within(name)) {
      return { ref: { kind, name: name.value }, start: name.range![0], end: name.range![1] };
    }
    if (kind !== "Relationship") continue;
    const edges = doc.getIn(["spec", "edges"], true);
    if (!isSeq(edges)) continue;
    for (const item of edges.items) {
      for (const side of ["from", "to"] as const) {
        const end = isMap(item) ? item.get(side, true) : null;
        const ref = endRef(end);
        const id = scalarAt(end, "id");
        if (ref && id && within(id)) return { ref, start: id.range![0], end: id.range![1] };
      }
    }
  }
  return null;
}

/** A manifest document's identity, read from its source; null when it has no kind or name. */
export function manifestRef(source: string): ElementRef | null {
  const doc = parseDocuments(source)?.[0];
  const kind = doc && kindOf(doc);
  const name = doc && nameNode(doc)?.value;
  return typeof kind === "string" && typeof name === "string" ? { kind, name } : null;
}

const MANIFEST_NAME = /^[\w.-]+\.opscr\.ya?ml$/i;

/**
 * Writes a whole manifest document: in place of the one with the same kind and name (only its
 * range changes), else appended to `file` — created when it is a new `*.opscr.yaml` name — or
 * to the first file. Null when the source is not a manifest or a file does not parse.
 */
export function upsertDocument(
  files: readonly SourceText[],
  source: string,
  file?: string,
): { files: SourceText[]; replaced: boolean; ref: ElementRef } | null {
  const ref = manifestRef(source);
  const parsed = parseAll(files);
  if (!ref || !parsed) return null;
  const found = findManifest(parsed, ref);
  if (found) {
    const { file: target, docs } = parsed[found.at]!;
    const edit = replaceDocument(target.text, docs[found.doc]!, source);
    return { files: commit(files, new Map([[found.at, [edit]]])), replaced: true, ref };
  }
  const home = files.findIndex((f) => f.name === file);
  if (home >= 0 || !file || !MANIFEST_NAME.test(file)) {
    const at = Math.max(0, home);
    if (files.length === 0) return null;
    return {
      files: files.map((f, i) => (i === at ? { ...f, text: appendDocument(f.text, source) } : f)),
      replaced: false,
      ref,
    };
  }
  return {
    files: [...files, { name: file, text: appendDocument("", source) }],
    replaced: false,
    ref,
  };
}

/**
 * Moves an element to another parent: its first `belongsTo` (the one that draws it nested) now
 * points at `parent` — retargeted in place, added when it has none, cut when `parent` is null
 * (moved to the top level). Null when the element has no manifest or a file does not parse.
 */
export function setParent(
  files: readonly SourceText[],
  ref: ElementRef,
  parent: ElementRef | null,
): SourceText[] | null {
  const parsed = parseAll(files);
  if (!parsed || !findManifest(parsed, ref)) return null;
  const edge = edgesOf(parsed).find(
    (e) => e.source.type === "belongsTo" && same(e.source.from, ref),
  );
  if (!parent) {
    if (!edge) return [...files];
    const edits = new Map<number, TextEdit[]>();
    return cutEdges(parsed, [edge], edits) ? commit(files, edits) : null;
  }
  if (!edge) return addEdge(files, { from: ref, to: parent, type: "belongsTo" });
  if (same(edge.source.to, parent)) return [...files];
  const to = parsed[edge.at]!.docs[edge.doc]!.getIn(["spec", "edges", edge.item, "to"], true);
  const kind = scalarAt(to, "kind");
  const id = scalarAt(to, "id");
  if (!kind || !id) return null;
  return commit(
    files,
    new Map([[edge.at, [replaceScalar(kind, parent.kind), replaceScalar(id, parent.name)]]]),
  );
}
