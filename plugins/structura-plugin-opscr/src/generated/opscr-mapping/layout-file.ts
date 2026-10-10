/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host's src/lib/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the host files and re-sync instead of changing this file.
 */

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
