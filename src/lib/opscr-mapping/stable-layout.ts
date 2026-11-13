import type { ViewBox, ViewLayoutResult } from "./layout";
import type { TechnicalView } from "./types";

/** Room a panel keeps around its children — the layout engine's padding. */
const PANEL_PADDING = 40;
/** Gap left between a new element and the sibling it was moved below. */
const STACK_GAP = 40;
/** Gap between a new element and the sibling it is connected to, along the flow (left to right). */
const FLOW_GAP = 80;
/**
 * The room a card takes on the canvas at most. The canvas draws a card as big as its content —
 * its name, technology, the view it opens, "explore inside" — up to 260px wide, while the boxes
 * the engine is given say 180×80: placing beside drawn cards by those boxes would overlap them.
 */
const CARD_ROOM = { width: 260, height: 160 };

const overlaps = (a: ViewBox, b: ViewBox): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const distance = (a: ViewBox, b: ViewBox): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * `box` where it is if it overlaps nothing in `placed`; else the free spot nearest to it, beside
 * (after) or above or below what is placed — never past `floor`. A column that is full sends it
 * to the next one instead of far down.
 */
function nearestFree(box: ViewBox, placed: readonly ViewBox[], floor: number): ViewBox {
  const free = (b: ViewBox) => !placed.some((p) => overlaps(p, b));
  if (free(box)) return box;
  const xs = [box.x, ...placed.map((p) => p.x + p.width + FLOW_GAP)];
  const ys = [
    box.y,
    ...placed.map((p) => p.y + p.height + STACK_GAP),
    ...placed.map((p) => p.y - box.height - STACK_GAP),
  ];
  let best: ViewBox | undefined;
  for (const x of xs) {
    for (const y of ys) {
      if (x < floor || y < floor) continue;
      const candidate = { ...box, x, y };
      if (!free(candidate)) continue;
      if (!best || distance(candidate, box) < distance(best, box)) best = candidate;
    }
  }
  if (best) return best;
  // Nothing beside anything: below everything in its column, as before.
  const moved = { ...box };
  for (let blocker = placed.find((p) => overlaps(p, moved)); blocker;) {
    moved.y = blocker.y + blocker.height + STACK_GAP;
    blocker = placed.find((p) => overlaps(p, moved));
  }
  return moved;
}

/** Whether `previous` still places `id`: it has a box there, under the same parent. */
const keeps = (
  previous: ViewLayoutResult,
  id: string,
  parentOf: ReadonlyMap<string, string | null>,
): boolean =>
  previous.boxes.has(id) &&
  (!previous.parents?.has(id) || previous.parents.get(id) === (parentOf.get(id) ?? null));

/**
 * Whether `stabilizeLayout` would place every element of `view` from `previous` alone — no new
 * element, none under another parent. The layout engine's result is not read then, so a host
 * can skip running it: an edit of text alone (a description, a provider) costs no layout.
 */
export function previousCoversView(
  view: TechnicalView,
  previous: ViewLayoutResult | undefined,
): boolean {
  if (!previous) return false;
  const parentOf = new Map(view.nodes.map((n) => [n.id, n.parentId]));
  return view.nodes.every((n) => keeps(previous, n.id, parentOf));
}

/**
 * Keeps a picture still across an edit.
 *
 * `fresh` is the layout engine's result for the new view (ideally seeded with `previous`);
 * `previous` is what the reader saw. Every element present in `previous` keeps its box
 * (position relative to its parent). Among siblings that are mostly new, a new element goes where
 * `fresh` put it relative to its nearest surviving sibling, then moves down until it overlaps no
 * sibling. Among siblings that are mostly kept, a new element connected to one already placed
 * goes beside it along the flow — after what calls it, before what it calls — at the nearest
 * free spot, with the room its drawn siblings take. Panels keep their position and grow — never
 * shrink — to hold their children. Without `previous` the
 * fresh layout is returned as it is.
 *
 * Pure: no layout engine here, so the policy is testable and shared by every host.
 */
export function stabilizeLayout(
  view: TechnicalView,
  fresh: ViewLayoutResult,
  previous: ViewLayoutResult | undefined,
): ViewLayoutResult {
  const parentOf = new Map(view.nodes.map((n) => [n.id, n.parentId]));
  if (!previous) return { ...fresh, parents: parentOf };

  const childrenOf = new Map<string | null, string[]>();
  for (const node of view.nodes) {
    const siblings = childrenOf.get(node.parentId);
    if (siblings) siblings.push(node.id);
    else childrenOf.set(node.parentId, [node.id]);
  }
  const depth = new Map<string, number>();
  /**
   * Boxes that still mean something: an element moved to another parent keeps its size, but
   * its old position was relative to the old parent — it is placed like a new one.
   */
  const kept = new Map([...previous.boxes].filter(([id]) => keeps(previous, id, parentOf)));
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    const parent = parentOf.get(id) ?? null;
    const value = parent === null ? 0 : depthOf(parent) + 1;
    depth.set(id, value);
    return value;
  };

  const freshBox = (id: string): ViewBox =>
    fresh.boxes.get(id) ?? previous.boxes.get(id) ?? { x: 0, y: 0, width: 0, height: 0 };
  const boxes = new Map<string, ViewBox>();

  // Sizes of leaves are known up front; a panel's size waits for its children.
  for (const node of view.nodes) {
    if (childrenOf.has(node.id)) continue;
    const before = previous.boxes.get(node.id);
    const now = freshBox(node.id);
    boxes.set(node.id, {
      x: 0,
      y: 0,
      width: (before ?? now).width,
      height: (before ?? now).height,
    });
  }

  /** The element among `siblings` that holds `id` (itself, or its ancestor there). */
  const holder = (id: string, siblings: ReadonlySet<string>): string | undefined => {
    for (let at: string | null = id, depth = 0; at !== null && depth < 64; depth++) {
      if (siblings.has(at)) return at;
      at = parentOf.get(at) ?? null;
    }
    return undefined;
  };

  /** The room a card placed beside its siblings takes on the canvas: its panel holds that. */
  const roomFor = new Map<string, ViewBox>();
  const extentOf = (id: string): ViewBox => roomFor.get(id) ?? boxes.get(id)!;

  const placeSiblings = (ids: readonly string[], insidePanel: boolean): void => {
    const survivors = ids.filter((id) => kept.has(id));
    const placed: ViewBox[] = [];
    const placedIds = new Set<string>();
    for (const id of survivors) {
      const before = kept.get(id)!;
      const box = { ...boxes.get(id)!, x: before.x, y: before.y };
      boxes.set(id, box);
      placed.push(box);
      placedIds.add(id);
    }
    const floor = insidePanel ? PANEL_PADDING : -Infinity;
    const waiting = ids
      .filter((id) => !kept.has(id))
      .sort((a, b) => freshBox(a).y - freshBox(b).y || a.localeCompare(b));
    /** Where the engine put `id`, moved as its nearest surviving sibling was. */
    const fromFresh = (id: string) => {
      const target = freshBox(id);
      const anchor = survivors
        .filter((s) => fresh.boxes.has(s))
        .sort((a, b) => distance(freshBox(a), target) - distance(freshBox(b), target))[0];
      const shift = anchor
        ? {
            x: kept.get(anchor)!.x - freshBox(anchor).x,
            y: kept.get(anchor)!.y - freshBox(anchor).y,
          }
        : { x: 0, y: 0 };
      return {
        ...boxes.get(id)!,
        x: Math.max(floor, target.x + shift.x),
        y: Math.max(floor, target.y + shift.y),
      };
    };

    // Mostly new (a first drawing, a big edit): the engine's arrangement is the better guide.
    if (survivors.length === 0 || waiting.length > survivors.length) {
      for (const id of waiting) {
        const box = fromFresh(id);
        for (let blocker = placed.find((p) => overlaps(p, box)); blocker;) {
          box.y = blocker.y + blocker.height + STACK_GAP;
          blocker = placed.find((p) => overlaps(p, box));
        }
        boxes.set(id, box);
        placed.push(box);
      }
      return;
    }

    // Mostly kept (an initiative over the root, a few additions): each new one joins the picture
    // beside what it is connected to, along the flow.
    const siblings = new Set(ids);
    const links = new Map<string, Array<{ other: string; calls: boolean }>>();
    for (const edge of view.edges) {
      const source = holder(edge.sourceId, siblings);
      const target = holder(edge.targetId, siblings);
      if (!source || !target || source === target) continue;
      links.set(source, [...(links.get(source) ?? []), { other: target, calls: true }]);
      links.set(target, [...(links.get(target) ?? []), { other: source, calls: false }]);
    }
    const linkedTo = (id: string) => (links.get(id) ?? []).filter((l) => placedIds.has(l.other));
    // A new card takes the room its drawn siblings take: the engine's size is a guess, the
    // canvas draws cards as big as their content.
    const leaves = survivors.filter((id) => !childrenOf.has(id)).map((id) => boxes.get(id)!);
    const card = {
      width: Math.max(CARD_ROOM.width, ...leaves.map((b) => b.width)),
      height: Math.max(CARD_ROOM.height, ...leaves.map((b) => b.height)),
    };
    /** What is drawn takes the room its card does, not the box it was given. */
    const roomOf = (id: string): ViewBox => {
      const box = boxes.get(id)!;
      return childrenOf.has(id)
        ? box
        : {
            ...box,
            width: Math.max(box.width, card.width),
            height: Math.max(box.height, card.height),
          };
    };
    const occupied = survivors.map(roomOf);
    while (waiting.length > 0) {
      // One linked to what is placed first (the most linked), so a chain of new ones follows on.
      const linked = waiting.filter((id) => linkedTo(id).length > 0);
      const id = linked.sort((a, b) => linkedTo(b).length - linkedTo(a).length)[0] ?? waiting[0]!;
      waiting.splice(waiting.indexOf(id), 1);
      const size = boxes.get(id)!;
      const target = freshBox(id);
      const link = linkedTo(id).sort(
        (a, b) => distance(freshBox(a.other), target) - distance(freshBox(b.other), target),
      )[0];
      let start: ViewBox;
      if (link) {
        const at = roomOf(link.other);
        const x = link.calls
          ? at.x - Math.max(size.width, card.width) - FLOW_GAP
          : at.x + at.width + FLOW_GAP;
        start = { ...size, x: Math.max(floor, x), y: at.y };
      } else start = fromFresh(id);
      const room = childrenOf.has(id)
        ? start
        : {
            ...start,
            width: Math.max(size.width, card.width),
            height: Math.max(size.height, card.height),
          };
      const spot = nearestFree(room, occupied, floor);
      boxes.set(id, { ...size, x: spot.x, y: spot.y });
      if (!childrenOf.has(id)) roomFor.set(id, spot);
      occupied.push(spot);
      placedIds.add(id);
    }
  };

  const panels = view.nodes
    .filter((n) => childrenOf.has(n.id))
    .sort((a, b) => depthOf(b.id) - depthOf(a.id));
  for (const panel of panels) {
    const children = childrenOf.get(panel.id)!;
    placeSiblings(children, true);
    const right = Math.max(...children.map((id) => extentOf(id).x + extentOf(id).width));
    const bottom = Math.max(...children.map((id) => extentOf(id).y + extentOf(id).height));
    const base = previous.boxes.get(panel.id) ?? freshBox(panel.id);
    boxes.set(panel.id, {
      x: 0,
      y: 0,
      width: Math.max(base.width, right + PANEL_PADDING),
      height: Math.max(base.height, bottom + PANEL_PADDING),
    });
  }
  placeSiblings(childrenOf.get(null) ?? [], false);

  // Routes were computed for other positions; the canvas routes connections itself.
  return { boxes, edgeRoutes: new Map(), parents: parentOf };
}
