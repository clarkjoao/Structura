import type { ViewBox, ViewLayoutResult } from "./layout";

/**
 * The layout sidecar: where each drawn element sits, kept beside the manifests so YAML stays
 * free of coordinates. Keys are view node ids (`Kind/name`); boxes are parent-relative, like a
 * `ViewLayoutResult`, so a parsed sidecar can seed `stabilizeLayout` as it is.
 */
export const LAYOUT_FILE = "opscr.layout.json";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** The sidecar's boxes; entries that are not boxes are skipped, an unreadable file is null. */
export function parseLayoutFile(text: string): ViewLayoutResult | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const elements =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)["elements"]
      : null;
  if (typeof elements !== "object" || elements === null) return null;
  const boxes = new Map<string, ViewBox>();
  for (const [key, value] of Object.entries(elements)) {
    if (typeof value !== "object" || value === null) continue;
    const { x, y, width, height } = value as Record<string, unknown>;
    if (isNumber(x) && isNumber(y) && isNumber(width) && isNumber(height)) {
      boxes.set(key, { x, y, width, height });
    }
  }
  return { boxes, edgeRoutes: new Map() };
}

/**
 * Stable text for a set of boxes: sorted keys, whole numbers, one element per line — so the
 * same arrangement always gives the same bytes and a move is a one-line git diff.
 */
export function serializeLayoutFile(boxes: ReadonlyMap<string, ViewBox>): string {
  const lines = [...boxes.keys()].sort().map((key) => {
    const b = boxes.get(key)!;
    const box = [b.x, b.y, b.width, b.height].map(Math.round);
    return `    ${JSON.stringify(key)}: { "x": ${box[0]}, "y": ${box[1]}, "width": ${box[2]}, "height": ${box[3]} }`;
  });
  const elements = lines.length > 0 ? `{\n${lines.join(",\n")}\n  }` : "{}";
  return `{\n  "version": 1,\n  "elements": ${elements}\n}\n`;
}

/** `base` with `over`'s boxes laid on top (either may be absent). */
export function overlayLayouts(
  base: ViewLayoutResult | null | undefined,
  over: ViewLayoutResult | null | undefined,
): ViewLayoutResult | undefined {
  if (!base) return over ?? undefined;
  if (!over) return base;
  // A box's parent comes from the layer its box came from.
  const parents = new Map<string, string | null>();
  for (const id of new Set([...base.boxes.keys(), ...over.boxes.keys()])) {
    const layer = over.boxes.has(id) ? over : base;
    if (layer.parents?.has(id)) parents.set(id, layer.parents.get(id)!);
  }
  return {
    boxes: new Map([...base.boxes, ...over.boxes]),
    edgeRoutes: new Map([...base.edgeRoutes, ...over.edgeRoutes]),
    ...(parents.size > 0 ? { parents } : {}),
  };
}

/**
 * Version 2: one set of boxes per View (`views` → view name → `Kind/name` → box), because one
 * element can sit in several diagrams. The default (view-less) diagram keeps its boxes under
 * `elements`, exactly where a version 1 file has them, so a version 1 file is a version 2 file
 * with no views.
 */
export interface LayoutFiles {
  /** The default diagram's layout. */
  base: ViewLayoutResult | null;
  views: ReadonlyMap<string, ViewLayoutResult>;
}

function boxesOf(entries: unknown): Map<string, ViewBox> {
  const boxes = new Map<string, ViewBox>();
  if (typeof entries !== "object" || entries === null) return boxes;
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value !== "object" || value === null) continue;
    const { x, y, width, height } = value as Record<string, unknown>;
    if (isNumber(x) && isNumber(y) && isNumber(width) && isNumber(height)) {
      boxes.set(key, { x, y, width, height });
    }
  }
  return boxes;
}

/** Version 1 or 2; an unreadable file is null. */
export function parseLayoutFiles(text: string): LayoutFiles | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const base = parseLayoutFile(text);
  const views = new Map<string, ViewLayoutResult>();
  if (record["version"] === 2) {
    const raw = record["views"];
    if (typeof raw === "object" && raw !== null) {
      for (const [name, entries] of Object.entries(raw)) {
        views.set(name, { boxes: boxesOf(entries), edgeRoutes: new Map() });
      }
    }
    return { base, views };
  }
  return base ? { base, views } : null;
}

const boxLines = (boxes: ReadonlyMap<string, ViewBox>, indent: string): string[] =>
  [...boxes.keys()].sort().map((key) => {
    const b = boxes.get(key)!;
    const box = [b.x, b.y, b.width, b.height].map(Math.round);
    return `${indent}${JSON.stringify(key)}: { "x": ${box[0]}, "y": ${box[1]}, "width": ${box[2]}, "height": ${box[3]} }`;
  });

/**
 * Stable text for a version 2 sidecar: the default diagram's boxes (when it has any) under
 * `elements`, then the views — sorted keys, whole numbers, one element per line.
 */
export function serializeLayoutFiles(
  views: ReadonlyMap<string, ReadonlyMap<string, ViewBox>>,
  base?: ReadonlyMap<string, ViewBox>,
): string {
  const blocks = [...views.keys()].sort().map((name) => {
    const lines = boxLines(views.get(name)!, "      ");
    return `    ${JSON.stringify(name)}: ${lines.length > 0 ? `{\n${lines.join(",\n")}\n    }` : "{}"}`;
  });
  const viewsText = blocks.length > 0 ? `{\n${blocks.join(",\n")}\n  }` : "{}";
  const baseLines = base ? boxLines(base, "    ") : [];
  const elements = baseLines.length > 0 ? `  "elements": {\n${baseLines.join(",\n")}\n  },\n` : "";
  return `{\n  "version": 2,\n${elements}  "views": ${viewsText}\n}\n`;
}

/** The boxes of one diagram — the named View's, or the default diagram's — or null if none. */
export function layoutFor(text: string, view: string | undefined): ViewLayoutResult | null {
  const files = parseLayoutFiles(text);
  if (!files) return null;
  return view === undefined ? files.base : (files.views.get(view) ?? null);
}

/**
 * The sidecar text after one diagram's boxes change, keeping every other diagram's. A file
 * with no views stays a version 1 file, byte for byte what `serializeLayoutFile` writes.
 */
export function updateLayoutFile(
  current: string | undefined,
  view: string | undefined,
  boxes: ReadonlyMap<string, ViewBox>,
): string {
  const files = current ? parseLayoutFiles(current) : null;
  const views = new Map([...(files?.views ?? [])].map(([name, v]) => [name, v.boxes]));
  if (view === undefined && views.size === 0) return serializeLayoutFile(boxes);
  if (view !== undefined) views.set(view, boxes);
  return serializeLayoutFiles(views, view === undefined ? boxes : files?.base?.boxes);
}
