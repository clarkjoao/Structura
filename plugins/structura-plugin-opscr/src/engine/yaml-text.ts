import {
  isMap,
  isScalar,
  isSeq,
  parseAllDocuments,
  stringify,
  type Document,
  type Node,
  type Scalar,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";

/**
 * Text surgery on YAML sources: every change is a splice at a node's source range, so bytes
 * outside the touched node — comments, quoting, blank lines, other documents — never change.
 * Nothing here re-serializes a document.
 */

export interface TextEdit {
  start: number;
  end: number;
  insert: string;
}

export type ParsedDocument = Document.Parsed;

/** The file's documents, or null when any of them has a parse error. */
export function parseDocuments(text: string): ParsedDocument[] | null {
  const docs: ParsedDocument[] = Array.from(parseAllDocuments(text));
  return docs.some((d) => d.errors.length > 0) ? null : docs;
}

/** Applies non-overlapping edits given in original-text positions. */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((acc, e) => acc.slice(0, e.start) + e.insert + acc.slice(e.end), text);
}

const lineStart = (text: string, pos: number) => text.lastIndexOf("\n", pos - 1) + 1;
const lineEndAfter = (text: string, pos: number) => {
  const i = text.indexOf("\n", pos);
  return i < 0 ? text.length : i + 1;
};
/** End of a block node, extended to the end of its last line. */
const blockEnd = (text: string, node: Node) => {
  const end = node.range![1];
  return end > 0 && text[end - 1] === "\n" ? end : lineEndAfter(text, end);
};

/** `value` written the way `original` was written: same quoting, plain only when safe. */
export function renderScalar(value: string, original?: Scalar): string {
  if (original?.type === "QUOTE_SINGLE") return `'${value.replace(/'/g, "''")}'`;
  if (original?.type === "QUOTE_DOUBLE") return JSON.stringify(value);
  const plain = stringify(value).replace(/\n$/, "");
  return plain === value ? value : JSON.stringify(value);
}

export function replaceScalar(node: Scalar, value: string): TextEdit {
  const [start, end] = node.range!;
  return { start, end, insert: renderScalar(value, node) };
}

/** The pair's string value node, if the map holds `key` with a scalar value. */
export function scalarAt(map: unknown, key: string): Scalar | null {
  if (!isMap(map)) return null;
  const value = map.get(key, true);
  return isScalar(value) ? value : null;
}

/**
 * Sets `key: value` in a block map: in place when the key holds a scalar, else as a new line
 * after the map's last entry in the map's own indentation. Null for a flow or empty map.
 */
export function setMapValue(
  text: string,
  map: YAMLMap,
  key: string,
  value: string,
): TextEdit | null {
  const current = scalarAt(map, key);
  if (current) return replaceScalar(current, value);
  const first = map.items[0]?.key as Node | undefined;
  if (map.flow || !first?.range) return null;
  const indent = text.slice(lineStart(text, first.range[0]), first.range[0]);
  if (indent.trim() !== "") return null;
  const at = blockEnd(text, map);
  return { start: at, end: at, insert: `${indent}${key}: ${renderScalar(value)}\n` };
}

/** Cuts a block sequence item along whole lines (`- ` line through its last line). */
export function cutSeqItem(text: string, seq: YAMLSeq, index: number): TextEdit | null {
  const item = seq.items[index] as Node | undefined;
  if (seq.flow || !item?.range) return null;
  const start = lineStart(text, item.range[0]);
  if (!/^[ \t]*-[ \t]+$/.test(text.slice(start, item.range[0]))) return null;
  return { start, end: blockEnd(text, item), insert: "" };
}

/**
 * Appends an item after a block sequence's last item, in its indentation. `lines` are the
 * item's lines relative to the item's own column; the first follows the `- `.
 */
export function appendSeqItem(
  text: string,
  seq: YAMLSeq,
  lines: readonly string[],
): TextEdit | null {
  const last = seq.items[seq.items.length - 1] as Node | undefined;
  if (seq.flow || !last?.range) return null;
  const prefix = text.slice(lineStart(text, last.range[0]), last.range[0]);
  if (!/^[ \t]*-[ \t]+$/.test(prefix)) return null;
  const pad = " ".repeat(prefix.length);
  const at = blockEnd(text, last);
  const body = lines.map((line, i) => (i === 0 ? prefix : pad) + line).join("\n");
  return { start: at, end: at, insert: `${body}\n` };
}

/** Where a document's own text starts: after its `---` marker line, if it has one. */
function contentStart(text: string, doc: ParsedDocument): number {
  const start = doc.range[0];
  return text.startsWith("---", start) ? lineEndAfter(text, start) : start;
}

/** The document's source without its `---` marker, ending with a newline. */
export function documentSource(text: string, doc: ParsedDocument): string {
  const source = text.slice(contentStart(text, doc), doc.range[2]);
  return source.endsWith("\n") ? source : `${source}\n`;
}

/**
 * Replaces a document's own text (after its `---` marker) with `source`, keeping the blank
 * lines that separated it from the next document.
 */
export function replaceDocument(text: string, doc: ParsedDocument, source: string): TextEdit {
  const start = contentStart(text, doc);
  const end = doc.range[2];
  const trailing = /\n(\s*)$/.exec(text.slice(start, end))?.[1] ?? "";
  const body = source.replace(/\s+$/, "");
  return { start, end, insert: `${body}\n${trailing.replace(/[^\n]/g, "")}` };
}

/** Cuts document `index`; the first document also takes the next one's `---` marker. */
export function cutDocument(
  text: string,
  docs: readonly ParsedDocument[],
  index: number,
): TextEdit {
  const doc = docs[index]!;
  const next = docs[index + 1];
  if (text.startsWith("---", doc.range[0]) || !next) {
    return { start: doc.range[0], end: doc.range[2], insert: "" };
  }
  return { start: doc.range[0], end: contentStart(text, next), insert: "" };
}

/** Appends a document (its source without a marker) at the end of the file. */
export function appendDocument(text: string, source: string): string {
  const body = source.endsWith("\n") ? source : `${source}\n`;
  if (text.trim() === "") return body;
  return `${text}${text.endsWith("\n") ? "" : "\n"}---\n${body}`;
}

export { isMap, isScalar, isSeq };
