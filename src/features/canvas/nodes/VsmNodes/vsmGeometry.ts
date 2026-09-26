/**
 * Pure geometry for the Value Stream Mapping shapes, as functions of the
 * node's box — the same approach as `ProcessNode/flowShapeGeometry`: fixed
 * features keep their size, straight runs grow, nothing is stretched.
 */

const INSET = 1;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Height of the factory's saw-tooth roof. */
export const FACTORY_ROOF = 22;

/**
 * The factory: a rectangular body under a three-tooth saw-tooth roof. Returns
 * the body outline and, separately, the roof line — the part the accent paints.
 */
export function factoryPaths(w: number, h: number): { body: string; roof: string } {
  const roof = Math.min(FACTORY_ROOF, h / 3);
  const tooth = (w - 2 * INSET) / 3;
  const body =
    `M${INSET} ${round(roof + INSET)} V${round(h - INSET)} H${round(w - INSET)} ` +
    `V${round(roof + INSET)} Z`;
  const points: string[] = [`M${INSET} ${round(roof + INSET)}`];
  for (let i = 0; i < 3; i += 1) {
    const x0 = INSET + i * tooth;
    points.push(`L${round(x0)} ${INSET}`, `L${round(x0 + tooth)} ${round(roof + INSET)}`);
  }
  return { body, roof: points.join(" ") };
}

/** Where a factory's handles sit: halfway down the body's sides, below the roof. */
export function factoryHandles(w: number, h: number) {
  const roof = Math.min(FACTORY_ROOF, h / 3);
  const y = round((roof + INSET + h) / 2);
  return { left: { x: 0, y }, right: { x: w, y } };
}

/** Height of the chip row under the inventory triangle. */
export const INVENTORY_CHIPS = 34;

/** The inventory triangle, apex up, over the chip row. */
export function inventoryTriangle(w: number, h: number): { path: string; height: number } {
  const height = Math.max(20, h - INVENTORY_CHIPS);
  return {
    path: `M${round(w / 2)} ${INSET} L${round(w - INSET)} ${round(height)} H${INSET} Z`,
    height,
  };
}

/** Handles halfway up the triangle's two slanted sides. */
export function inventoryHandles(w: number, h: number) {
  const { height } = inventoryTriangle(w, h);
  const y = round((INSET + height) / 2);
  return { left: { x: round(w / 4), y }, right: { x: round((3 * w) / 4), y } };
}

/**
 * The supermarket: shelves open to the left — a mirrored E. Top, bottom and
 * two shelves between them, all joined on the right.
 */
export function supermarketPath(w: number, h: number): string {
  const inset = 1.25;
  const right = round(w - inset);
  const shelves = [inset, h / 3, (2 * h) / 3, h - inset].map(round);
  return [
    `M${right} ${shelves[0]} V${shelves[3]}`,
    ...shelves.map((y) => `M${inset} ${y} H${right}`),
  ].join(" ");
}

/** Length of the push arrow's head. */
export const PUSH_HEAD = 22;

/**
 * The push arrow: a block arrow whose shaft is striped — three filled bands
 * with gaps between them — and a solid head.
 */
export function pushArrowPaths(
  w: number,
  h: number,
): { stripes: string[]; head: string; shaft: string } {
  const head = Math.min(PUSH_HEAD, w / 3);
  const shaftTop = round(h * 0.25);
  const shaftBottom = round(h * 0.75);
  const shaftEnd = w - head;
  const band = (shaftEnd - INSET) / 5;
  const stripes = [0, 2, 4].map((i) => {
    const x0 = round(INSET + i * band);
    const x1 = round(INSET + (i + 1) * band);
    return `M${x0} ${shaftTop} H${x1} V${shaftBottom} H${x0} Z`;
  });
  const headPath =
    `M${round(shaftEnd)} ${INSET} L${round(w - INSET)} ${round(h / 2)} ` +
    `L${round(shaftEnd)} ${round(h - INSET)} Z`;
  const shaft = `M${INSET} ${shaftTop} H${round(shaftEnd)} V${shaftBottom} H${INSET} Z`;
  return { stripes, head: headPath, shaft };
}

/**
 * How far in each of the burst's 18 valleys reaches, as a fraction of the
 * radius. Fixed rather than random, so the burst is irregular but the same
 * every time it is drawn — and the same in the reader as in the editor.
 */
const KAIZEN_VALLEYS = [
  0.62, 0.74, 0.58, 0.7, 0.66, 0.55, 0.72, 0.6, 0.68, 0.57, 0.73, 0.63, 0.69, 0.56, 0.71, 0.61,
  0.67, 0.59,
];
/** And how far out each point reaches. */
const KAIZEN_PEAKS = [
  1, 0.9, 0.97, 0.88, 1, 0.93, 0.86, 0.99, 0.91, 0.95, 0.87, 1, 0.92, 0.89, 0.98, 0.9, 0.94, 0.96,
];

/** The kaizen burst: an irregular 18-point star filling the box. */
export function kaizenBurstPath(w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - INSET;
  const ry = h / 2 - INSET;
  const points: string[] = [];
  for (let i = 0; i < 18; i += 1) {
    const peak = ((i * 2) / 36) * Math.PI * 2 - Math.PI / 2;
    const valley = ((i * 2 + 1) / 36) * Math.PI * 2 - Math.PI / 2;
    points.push(
      `${round(cx + Math.cos(peak) * rx * KAIZEN_PEAKS[i])} ${round(cy + Math.sin(peak) * ry * KAIZEN_PEAKS[i])}`,
      `${round(cx + Math.cos(valley) * rx * KAIZEN_VALLEYS[i])} ${round(cy + Math.sin(valley) * ry * KAIZEN_VALLEYS[i])}`,
    );
  }
  return `M${points.join(" L")} Z`;
}

/** Width of the timeline's totals card. */
export const TIMELINE_TOTALS_W = 150;

/**
 * The timeline's square wave for `count` segments: each segment a high
 * plateau (waiting) then a low one (processing), all the same width, in the
 * space left of the totals card. Also returns where each plateau's label is
 * centred and the two levels.
 */
export function timelineWave(count: number, w: number, h: number) {
  const right = Math.max(INSET, w - TIMELINE_TOTALS_W - 12);
  const high = round(h * 0.35);
  const low = round(h * 0.65);
  const plateaus = Math.max(1, count * 2);
  const step = (right - INSET) / plateaus;
  const parts: string[] = [`M${INSET} ${high}`];
  const waitCentres: number[] = [];
  const processCentres: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const x0 = INSET + 2 * i * step;
    parts.push(`H${round(x0 + step)}`, `V${low}`, `H${round(x0 + 2 * step)}`);
    if (i < count - 1) parts.push(`V${high}`);
    waitCentres.push(round(x0 + step / 2));
    processCentres.push(round(x0 + (3 * step) / 2));
  }
  if (count === 0) parts.push(`H${round(right)}`);
  return { path: parts.join(" "), high, low, waitCentres, processCentres };
}
