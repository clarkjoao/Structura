/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host's src/lib/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the host files and re-sync instead of changing this file.
 */

import type { ViewBox, ViewLayoutResult } from "./layout";
import type { TechnicalView } from "./types";

/** Room a panel keeps around its children — the layout engine's padding. */
const PANEL_PADDING = 40;
/** Gap left between a new element and the sibling it was moved below. */
const STACK_GAP = 40;

const overlaps = (a: ViewBox, b: ViewBox): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const distance = (a: ViewBox, b: ViewBox): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Keeps a picture still across an edit.
 *
 * `fresh` is the layout engine's result for the new view (ideally seeded with `previous`);
 * `previous` is what the reader saw. Every element present in `previous` keeps its box
 * (position relative to its parent). A new element goes where `fresh` put it relative to
 * its nearest surviving sibling, then moves down until it overlaps no sibling. Panels keep
 * their position and grow — never shrink — to hold their children. Without `previous` the
 * fresh layout is returned as it is.
 *
 * Pure: no layout engine here, so the policy is testable and shared by every host.
 */
export function stabilizeLayout(
  view: TechnicalView,
  fresh: ViewLayoutResult,
  previous: ViewLayoutResult | undefined,
): ViewLayoutResult {
  if (!previous) return fresh;

  const childrenOf = new Map<string | null, string[]>();
  for (const node of view.nodes) {
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node.id]);
  }
  const depth = new Map<string, number>();
  const parentOf = new Map(view.nodes.map((n) => [n.id, n.parentId]));
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

  const placeSiblings = (ids: readonly string[], insidePanel: boolean): void => {
    const survivors = ids.filter((id) => previous.boxes.has(id));
    const placed: ViewBox[] = [];
    for (const id of survivors) {
      const before = previous.boxes.get(id)!;
      const box = { ...boxes.get(id)!, x: before.x, y: before.y };
      boxes.set(id, box);
      placed.push(box);
    }
    const newcomers = ids
      .filter((id) => !previous.boxes.has(id))
      .sort((a, b) => freshBox(a).y - freshBox(b).y || a.localeCompare(b));
    for (const id of newcomers) {
      const target = freshBox(id);
      const anchor = survivors
        .filter((s) => fresh.boxes.has(s))
        .sort((a, b) => distance(freshBox(a), target) - distance(freshBox(b), target))[0];
      const shift = anchor
        ? {
            x: previous.boxes.get(anchor)!.x - freshBox(anchor).x,
            y: previous.boxes.get(anchor)!.y - freshBox(anchor).y,
          }
        : { x: 0, y: 0 };
      const floor = insidePanel ? PANEL_PADDING : -Infinity;
      const box = {
        ...boxes.get(id)!,
        x: Math.max(floor, target.x + shift.x),
        y: Math.max(floor, target.y + shift.y),
      };
      for (let blocker = placed.find((p) => overlaps(p, box)); blocker;) {
        box.y = blocker.y + blocker.height + STACK_GAP;
        blocker = placed.find((p) => overlaps(p, box));
      }
      boxes.set(id, box);
      placed.push(box);
    }
  };

  const panels = view.nodes
    .filter((n) => childrenOf.has(n.id))
    .sort((a, b) => depthOf(b.id) - depthOf(a.id));
  for (const panel of panels) {
    const children = childrenOf.get(panel.id)!;
    placeSiblings(children, true);
    const right = Math.max(...children.map((id) => boxes.get(id)!.x + boxes.get(id)!.width));
    const bottom = Math.max(...children.map((id) => boxes.get(id)!.y + boxes.get(id)!.height));
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
  return { boxes, edgeRoutes: new Map() };
}
