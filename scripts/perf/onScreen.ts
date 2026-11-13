// Pure pieces of the perf:large harness (scripts/perf-large-diagram.ts), kept apart from
// Playwright so they are unit-tested (scripts/perf/onScreen.test.ts).

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What `bringOnScreen` needs from a browser page; the harness adapts Playwright's. */
export interface OnScreenDriver {
  paneBox(): Promise<Box | null>;
  targetBox(selector: string): Promise<Box | null>;
  /** Moves the pointer to (x, y) and sends one wheel tick of (dx, dy). */
  wheelAt(x: number, y: number, dx: number, dy: number): Promise<void>;
  wait(ms: number): Promise<void>;
}

const ON_SCREEN_MARGIN_PX = 160;
export const MAX_WHEEL_STEP_PX = 500;
export const MAX_PAN_STEPS = 60;

/**
 * The wheel tick that moves `target` toward the middle of `pane`, or null once the target's
 * reference point (the centre of its first 400x300 px, so a huge panel counts by its header
 * corner) sits inside the pane, `margin` away from every edge.
 */
export function panStepToward(
  target: Box,
  pane: Box,
  margin = ON_SCREEN_MARGIN_PX,
  maxStep = MAX_WHEEL_STEP_PX,
): { dx: number; dy: number } | null {
  const cx = target.x + Math.min(target.width, 400) / 2;
  const cy = target.y + Math.min(target.height, 300) / 2;
  const inside =
    cx > pane.x + margin &&
    cx < pane.x + pane.width - margin &&
    cy > pane.y + margin &&
    cy < pane.y + pane.height - margin;
  if (inside) return null;
  const clamp = (v: number) => Math.max(-maxStep, Math.min(maxStep, v));
  return {
    dx: clamp(cx - (pane.x + pane.width / 2)),
    dy: clamp(cy - (pane.y + pane.height / 2)),
  };
}

/**
 * Pans (wheel, as a user would) until `selector`'s box sits inside the canvas, away from the
 * toolbars. The opening viewport is the app's choice, not the fixture's: since the opening fit
 * centres a canvas that shows too little of the diagram (audit C3/R8), the nodes the scenarios
 * press can start off screen, where a press lands nowhere and every drag reported
 * `moved: false`.
 */
export async function bringOnScreen(driver: OnScreenDriver, selector: string): Promise<void> {
  const pane = await driver.paneBox();
  if (!pane) throw new Error("canvas not found");
  for (let i = 0; i < MAX_PAN_STEPS; i += 1) {
    const box = await driver.targetBox(selector);
    if (!box) throw new Error(`${selector} is not rendered`);
    const step = panStepToward(box, pane);
    if (!step) return;
    await driver.wheelAt(pane.x + pane.width / 2, pane.y + pane.height / 2, step.dx, step.dy);
    await driver.wait(60);
  }
  throw new Error(`could not bring ${selector} on screen`);
}

/** `PERF_CPU_THROTTLE` as a CDP throttling rate; anything that is not a number above 1 is none. */
export function cpuThrottleRate(raw: string | undefined): number {
  const rate = Number(raw ?? 1);
  return Number.isFinite(rate) && rate > 1 ? rate : 1;
}

/** Applies `rate` through a CDP session opened on demand; nothing is opened at rate 1. */
export async function applyCpuThrottle(
  rate: number,
  openSession: () => Promise<{ send(method: string, params: { rate: number }): Promise<unknown> }>,
): Promise<boolean> {
  if (rate <= 1) return false;
  const session = await openSession();
  await session.send("Emulation.setCPUThrottlingRate", { rate });
  return true;
}
