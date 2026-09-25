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
