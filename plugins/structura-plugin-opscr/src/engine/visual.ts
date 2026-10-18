import { parseVisualFile, type VisualFile } from "../generated/opscr-mapping";
import type { DiagramSnapshot } from "../types/plugin.types";
import type { BindingState } from "./sync";

/**
 * The visual layer of a bound folder (`opscr.visual.json`, written by opscr's draw.io import):
 * boundaries, services with no opscr Kind, decoration and their edges. Its elements are bound
 * like manifest elements, under `drawio:` keys, but they never reach the YAML or
 * `opscr.layout.json`: canvas moves, resizes and deletions of them are written back here.
 */

const VISUAL_KEY_PREFIX = "drawio:";
export const isVisualKey = (key: string): boolean => key.startsWith(VISUAL_KEY_PREFIX);

/** Connection keys are `source->target:type#n`; a visual connection has a visual end. */
const isVisualConnectionKey = (key: string): boolean => {
  const ends = key.slice(0, key.lastIndexOf(":"));
  return ends.split("->").some(isVisualKey);
};

/** The binding split in two: what reconcile may touch (manifests) and the visual layer. */
export function splitBinding(binding: BindingState): {
  manifest: BindingState;
  visual: BindingState;
} {
  const part = (keep: (key: string) => boolean): BindingState => ({
    ids: Object.fromEntries(Object.entries(binding.ids).filter(([k]) => keep(k))),
    signatures: Object.fromEntries(
      Object.entries(binding.signatures).filter(([k]) => keep(k.replace(/#id$/, ""))),
    ),
    connections: Object.fromEntries(
      Object.entries(binding.connections).filter(([k]) =>
        keep === isVisualKey ? isVisualConnectionKey(k) : !isVisualConnectionKey(k),
      ),
    ),
  });
  const manifest = part((k) => !isVisualKey(k));
  if (binding.tombstones) manifest.tombstones = binding.tombstones;
  return { manifest, visual: part(isVisualKey) };
}

export function mergeBinding(manifest: BindingState, visual: BindingState): BindingState {
  return {
    ...manifest,
    ids: { ...manifest.ids, ...visual.ids },
    signatures: { ...manifest.signatures, ...visual.signatures },
    connections: { ...manifest.connections, ...visual.connections },
  };
}

/** The diagram without the visual layer's components and connections, for reconcile. */
export function withoutVisual(diagram: DiagramSnapshot, visual: BindingState): DiagramSnapshot {
  const ids = new Set(Object.values(visual.ids));
  const connections = new Set(Object.values(visual.connections));
  return {
    ...diagram,
    components: diagram.components.filter((c) => !ids.has(c.id)),
    connections: diagram.connections.filter(
      (c) => !connections.has(c.id) && !ids.has(c.sourceId) && !ids.has(c.targetId),
    ),
  };
}

/** Page-absolute canvas positions, by component id. */
export function canvasAbsolute(diagram: DiagramSnapshot): Map<string, { x: number; y: number }> {
  const byId = new Map(diagram.components.map((c) => [c.id, c]));
  const out = new Map<string, { x: number; y: number }>();
  const at = (id: string, depth = 0): { x: number; y: number } => {
    const known = out.get(id);
    if (known) return known;
    const c = byId.get(id);
    const own = c?.position ?? { x: 0, y: 0 };
    const p = c?.parentId && depth < 64 ? at(c.parentId, depth + 1) : { x: 0, y: 0 };
    const abs = { x: p.x + own.x, y: p.y + own.y };
    out.set(id, abs);
    return abs;
  };
  for (const c of diagram.components) at(c.id);
  return out;
}

const round = (n: number) => Math.round(n);

/**
 * `opscr.visual.json` as the canvas shows it now: the boxes of the bound visual elements (moved
 * or resized), relative to their parent key as the file keeps them; elements deleted on the canvas
 * and the edges touching them are gone, and so are they from boundaries' members. Elements the
 * layer does not draw (bare decoration) are kept as they were. Null when the text is unreadable.
 */
export function visualText(
  text: string,
  binding: BindingState,
  diagram: DiagramSnapshot,
): string | null {
  const visual = parseVisualFile(text);
  if (!visual) return null;
  const live = new Map(diagram.components.map((c) => [c.id, c]));
  const abs = canvasAbsolute(diagram);
  const deleted = new Set(
    Object.entries(binding.ids)
      .filter(([key, id]) => isVisualKey(key) && !live.has(id) && visual.elements[key])
      .map(([key]) => key),
  );

  // Page-absolute position of a key as the file says, for parents the canvas does not show.
  const fileAbs = (key: string, depth = 0): { x: number; y: number } => {
    const e = visual.elements[key];
    if (!e || depth > 64) return { x: 0, y: 0 };
    const p = e.parent ? fileAbs(e.parent, depth + 1) : { x: 0, y: 0 };
    return { x: p.x + e.box.x, y: p.y + e.box.y };
  };
  const absOf = (key: string): { x: number; y: number } | undefined => {
    const id = binding.ids[key];
    return id && live.has(id) ? abs.get(id) : undefined;
  };

  const elements: VisualFile["elements"] = {};
  for (const [key, element] of Object.entries(visual.elements)) {
    if (deleted.has(key)) continue;
    const id = binding.ids[key];
    const component = id ? live.get(id) : undefined;
    let box = element.box;
    const here = absOf(key);
    if (component && here) {
      const parent = element.parent
        ? (absOf(element.parent) ?? fileAbs(element.parent))
        : { x: 0, y: 0 };
      box = {
        x: round(here.x - parent.x),
        y: round(here.y - parent.y),
        width: round(component.size?.width ?? element.box.width),
        height: round(component.size?.height ?? element.box.height),
      };
    }
    elements[key] = {
      ...element,
      box,
      ...(element.members ? { members: element.members.filter((m) => !deleted.has(m)) } : {}),
    };
  }
  const edges = visual.edges.filter(
    (e) => !(e.from && deleted.has(e.from)) && !(e.to && deleted.has(e.to)),
  );
  return serialize({ ...visual, elements, edges });
}

/** Same bytes as opscr writes: sorted keys, two-space indent, trailing newline. */
function serialize(file: VisualFile): string {
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort);
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, sort(v)]),
      );
    }
    return value;
  };
  const elements = Object.fromEntries(
    Object.entries(file.elements).map(([k, e]) => [
      k,
      { ...e, ...(e.members ? { members: [...e.members].sort() } : {}) },
    ]),
  );
  const edges = [...file.edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return `${JSON.stringify(sort({ ...file, elements, edges }), null, 2)}\n`;
}

/**
 * Moves that put the visual elements where `visual` says (it changed on disk): every bound visual
 * element whose canvas box differs from the file's, made relative to its canvas parent.
 */
export function visualMoves(
  visual: VisualFile,
  binding: BindingState,
  diagram: DiagramSnapshot,
): Array<{ id: string; x: number; y: number; width?: number; height?: number }> {
  const byId = new Map(diagram.components.map((c) => [c.id, c]));
  const abs = canvasAbsolute(diagram);
  const fileAbs = (key: string, depth = 0): { x: number; y: number } => {
    const e = visual.elements[key];
    if (e) {
      const p = e.parent && depth < 64 ? fileAbs(e.parent, depth + 1) : { x: 0, y: 0 };
      return { x: p.x + e.box.x, y: p.y + e.box.y };
    }
    const id = binding.ids[key];
    return (id && abs.get(id)) || { x: 0, y: 0 };
  };
  const moves: Array<{ id: string; x: number; y: number; width?: number; height?: number }> = [];
  for (const [key, element] of Object.entries(visual.elements)) {
    const id = binding.ids[key];
    const component = id ? byId.get(id) : undefined;
    if (!id || !component?.position) continue;
    const target = fileAbs(key);
    const holder = component.parentId
      ? (abs.get(component.parentId) ?? { x: 0, y: 0 })
      : { x: 0, y: 0 };
    const x = round(target.x - holder.x);
    const y = round(target.y - holder.y);
    const resized =
      !!component.size &&
      (Math.abs(component.size.width - element.box.width) > 0.5 ||
        Math.abs(component.size.height - element.box.height) > 0.5);
    if (
      Math.abs(component.position.x - x) <= 0.5 &&
      Math.abs(component.position.y - y) <= 0.5 &&
      !resized
    )
      continue;
    moves.push({
      id,
      x,
      y,
      ...(component.size ? { width: element.box.width, height: element.box.height } : {}),
    });
  }
  return moves;
}
