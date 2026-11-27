import { planDiagramAutoLayout } from "@/features/canvas/layout/autoLayoutDiagram";
import { edgeLabelBox } from "@/features/canvas/layout/edgeLabelBox";
import { layoutSizeOf } from "@/features/canvas/layout/fromDiagram";
import { placeIncrementally } from "@/features/canvas/layout/incrementalPlacement";
import { effectiveLayoutGaps } from "@/features/canvas/layout/layoutEngine";
import type { DiagramDirection } from "@/features/diagram/model/diagram.types";
import type { NodeLayout } from "@/features/diagram/model/layout.types";
import type { DiagramLayoutSettings } from "@/features/diagram/model/layout-settings";
import { diagramFromImporterGraph, type ImporterGraphInput } from "./graph-diagram";
import type { PluginLayoutBox } from "./plugin.types";

export interface PlaceGraphInput {
  graph: ImporterGraphInput;
  /**
   * Where elements are drawn now, by key, relative to `parentKey` (null: the root). A size of 0
   * (not known) is the canvas's size for the element's type.
   */
  previous?: Record<string, PluginLayoutBox & { parentKey: string | null }>;
  direction?: DiagramDirection;
  settings?: DiagramLayoutSettings;
}

const PLACE_ID = "structura-place";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A drawn element counts by its position; a size it does not have (≤ 0) is the canvas's. */
const isPlaced = (box: PluginLayoutBox | undefined): box is PluginLayoutBox =>
  box !== undefined && finite(box.x) && finite(box.y);

const hasSize = (box: PluginLayoutBox): boolean =>
  finite(box.width) && finite(box.height) && box.width > 0 && box.height > 0;

/**
 * Places an importer graph the way the canvas places a diagram, for a host that builds pictures
 * it did not draw (a plugin, the VSCode preview through the embed). Sizes are the canvas's: each
 * element is sized as its type is drawn, whatever the graph says.
 *
 * - Nothing drawn yet (no `previous` element under the same parent): the canvas's Arrange
 *   (`planDiagramAutoLayout`, no references) — reading direction, sources first, settings, labels.
 * - Nothing new: every box is `previous`'s, no engine run.
 * - Otherwise the canvas's automatic mode (`placeIncrementally`): kept elements stay exactly where
 *   they are; a new one goes one column after what it is connected from (before what it calls),
 *   on its row, and slides down until it overlaps nothing; containers grow to hold what lands in
 *   them. What a new container holds keeps the Arrange's arrangement inside it, and a new element
 *   with nothing placed to sit next to starts where the Arrange put it, beside the kept element
 *   nearest it there.
 *
 * Returns every component's box by key, relative to its parent.
 */
export async function placeGraph(input: PlaceGraphInput): Promise<Record<string, PluginLayoutBox>> {
  // The canvas sizes elements: a size in the graph is the host's guess.
  const graph: ImporterGraphInput = {
    components: (Array.isArray(input.graph?.components) ? input.graph.components : []).map(
      ({ width: _w, height: _h, ...component }) => component,
    ),
    connections: Array.isArray(input.graph?.connections) ? input.graph.connections : [],
  };
  const built = diagramFromImporterGraph(graph, PLACE_ID);
  const components = built.snapshot.components;
  // Every element at the size the layout gives it (`layoutSizeOf`): the canvas's, by type.
  const diagram = {
    ...built,
    nodeLayouts: Object.fromEntries(
      Object.entries(built.nodeLayouts).map(([id, layout]) => {
        const component = components[id];
        const size = component
          ? layoutSizeOf(component, built.nodeLayouts, undefined, components)
          : { width: layout.width ?? 0, height: layout.height ?? 0 };
        return [id, { ...layout, ...size }];
      }),
    ),
  };
  const connections = Object.values(diagram.snapshot.connections);
  const ids = Object.keys(components);
  if (ids.length === 0) return {};

  const previous = input.previous ?? {};
  const kept = new Set(
    ids.filter((id) => {
      const before = previous[id];
      return isPlaced(before) && (before.parentKey ?? null) === (components[id]!.parentId ?? null);
    }),
  );
  const boxOf = (layout: NodeLayout | undefined): PluginLayoutBox => ({
    x: layout?.x ?? 0,
    y: layout?.y ?? 0,
    width: layout?.width ?? 0,
    height: layout?.height ?? 0,
  });
  const result = (nodeLayouts: Record<string, NodeLayout>) =>
    Object.fromEntries(ids.map((id) => [id, boxOf(nodeLayouts[id])]));

  /** A kept element where it is drawn, at its drawn size, or the canvas's when it has none. */
  const keptLayout = (id: string, sized: NodeLayout): NodeLayout => {
    const before = previous[id]!;
    return hasSize(before)
      ? { ...sized, x: before.x, y: before.y, width: before.width, height: before.height }
      : { ...sized, x: before.x, y: before.y };
  };

  if (kept.size === ids.length) {
    return result(
      Object.fromEntries(ids.map((id) => [id, keptLayout(id, diagram.nodeLayouts[id]!)])),
    );
  }

  const direction = input.direction ?? "LR";
  const plan = await planDiagramAutoLayout({
    components,
    connections,
    nodeLayouts: diagram.nodeLayouts,
    autoRefs: false,
    direction,
    ...(input.settings && { settings: input.settings }),
  });
  const arranged: Record<string, NodeLayout> = { ...diagram.nodeLayouts };
  for (const layout of plan.layouts) {
    const base = arranged[layout.elementId];
    if (!base) continue;
    arranged[layout.elementId] = {
      ...base,
      x: layout.x,
      y: layout.y,
      ...(layout.width !== undefined && { width: layout.width }),
      ...(layout.height !== undefined && { height: layout.height }),
    };
  }
  if (kept.size === 0) return result(arranged);

  const childrenOf = new Map<string, string[]>();
  for (const id of ids) {
    const parent = components[id]!.parentId;
    if (parent && components[parent])
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), id]);
  }
  /** New, and so is everything it holds: it moves as one, as the Arrange laid it out. */
  const wholeNew = new Map<string, boolean>();
  const isWholeNew = (id: string, depth = 0): boolean => {
    const known = wholeNew.get(id);
    if (known !== undefined) return known;
    const value =
      !kept.has(id) &&
      depth < 64 &&
      (childrenOf.get(id) ?? []).every((c) => isWholeNew(c, depth + 1));
    wholeNew.set(id, value);
    return value;
  };
  // Placed one by one: each new element, unless it is inside a new container that holds nothing
  // drawn — what such a container holds rides along with it, as the Arrange put it.
  const dirty = ids.filter((id) => {
    if (kept.has(id)) return false;
    const parent = components[id]!.parentId;
    return !(parent && components[parent] && isWholeNew(parent));
  });

  const nodeLayouts: Record<string, NodeLayout> = {};
  for (const id of ids) {
    nodeLayouts[id] = kept.has(id) ? keptLayout(id, arranged[id]!) : arranged[id]!;
  }
  // The Arrange's coordinates are its own: a new element starts where it put it, moved as the
  // kept sibling nearest to it there was moved.
  for (const id of dirty) {
    const at = arranged[id]!;
    const parent = components[id]!.parentId ?? null;
    const siblings = ids.filter((s) => kept.has(s) && (components[s]!.parentId ?? null) === parent);
    const nearest = siblings.sort(
      (a, b) =>
        Math.hypot(arranged[a]!.x - at.x, arranged[a]!.y - at.y) -
        Math.hypot(arranged[b]!.x - at.x, arranged[b]!.y - at.y),
    )[0];
    if (!nearest) continue;
    nodeLayouts[id] = {
      ...at,
      x: at.x + (nodeLayouts[nearest]!.x - arranged[nearest]!.x),
      y: at.y + (nodeLayouts[nearest]!.y - arranged[nearest]!.y),
    };
  }

  const labelled = connections.some((c) => edgeLabelBox(c.label, c.technology) !== undefined);
  const gaps = effectiveLayoutGaps(input.settings, labelled);
  const placements = placeIncrementally({
    components,
    connections: diagram.snapshot.connections,
    nodeLayouts,
    dirtyIds: dirty,
    columnGap: gaps.layerGap,
    rowGap: Math.round(gaps.nodeGap / 2),
    direction,
    slideUnanchored: true,
  });
  for (const placement of placements) {
    const base = nodeLayouts[placement.elementId];
    if (!base) continue;
    nodeLayouts[placement.elementId] = {
      ...base,
      x: placement.x,
      y: placement.y,
      ...(placement.width !== undefined && { width: placement.width }),
      ...(placement.height !== undefined && { height: placement.height }),
    };
  }
  // A container holds what it holds: a new one placed around drawn children grows to fit them,
  // deepest first. Never shrinks.
  const depthOf = (id: string): number => {
    let depth = 0;
    for (let at = components[id]!.parentId; at && components[at] && depth < 64; depth++) {
      at = components[at]!.parentId;
    }
    return depth;
  };
  const pad = Math.round(gaps.nodeGap / 2);
  for (const id of [...childrenOf.keys()].sort((a, b) => depthOf(b) - depthOf(a))) {
    const box = nodeLayouts[id]!;
    let width = box.width ?? 0;
    let height = box.height ?? 0;
    for (const child of childrenOf.get(id)!) {
      const c = nodeLayouts[child]!;
      width = Math.max(width, Math.round(c.x + (c.width ?? 0) + pad));
      height = Math.max(height, Math.round(c.y + (c.height ?? 0) + pad));
    }
    nodeLayouts[id] = { ...box, width, height };
  }
  return result(nodeLayouts);
}
