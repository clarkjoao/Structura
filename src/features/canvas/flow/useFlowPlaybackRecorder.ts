import { useCallback, useEffect, useRef, useState } from "react";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import GIF from "gif.js";
import gifWorkerUrl from "gif.js/dist/gif.worker.js?url";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Flow } from "@/features/diagram";
import { getStepById, isConditionStep } from "@/features/diagram";
import { FLOW_PARTICLE_DURATION_MS } from "../canvas.constants";
import { useFlowMode } from "./FlowModeContext";
import { useFlowViewStore } from "./useFlowViewStore";
import { stepTargetIds } from "./reading/useFrameReadStep";
import { READING_MAX_ZOOM } from "./reading/readingFrame";

export type RecordingSpeed = "slow" | "normal" | "fast";

export const RECORDING_SPEED_MS: Record<RecordingSpeed, number> = {
  slow: 1500,
  normal: 1000,
  fast: 500,
};

/** Max output width in pixels — keeps text legible while bounding file size. */
const MAX_GIF_WIDTH = 1600;
/** Upper bound on the capture pixel ratio. */
const MAX_PIXEL_RATIO = 2;
/** Time for the reading rail to open (it narrows the canvas) before framing. */
const OPEN_SETTLE_MS = 450;
/** Time for a step's highlight to render before its frame is captured. */
const STEP_SETTLE_MS = 200;
/**
 * Spacing of the animation sub-frames that move the particle along the active
 * edge: 25fps. GIF delays are in hundredths of a second, so this is exactly 4cs,
 * and it divides the 1200ms particle period evenly. Do not go below 20ms —
 * browsers clamp shorter GIF delays to 100ms, which would slow the animation.
 */
const SUBFRAME_MS = 40;
/** Padding around the flow when it is framed for the recording. */
const FLOW_FRAME_PADDING = 0.12;
/** The last step is held longer so the loop restart is readable. */
const LAST_STEP_HOLD_FACTOR = 2;

/** Particle geometry — mirrors `EdgeParticle` (dash 6 / gap 106, 2.5 wide). */
const PARTICLE_DASH: [number, number] = [6, 106];
const PARTICLE_CYCLE = PARTICLE_DASH[0] + PARTICLE_DASH[1];
const PARTICLE_WIDTH = 2.5;
/**
 * Live, the particle is seen at the reading zoom (`READING_MAX_ZOOM`, 1): a
 * 2.5px-wide dash every ~112px. The GIF frames the whole flow, usually zoomed
 * out, which would shrink it to a dense trail of specks. So the particle
 * pattern is drawn at its reading-zoom screen size, times this emphasis to make
 * up for the GIF's lower frame rate and for GIFs being viewed scaled down.
 */
const PARTICLE_EMPHASIS = 1.5;
/** Soft halo under the particle, in the particle's color (width × / opacity). */
const PARTICLE_GLOW_WIDTH = 2.6;
const PARTICLE_GLOW_ALPHA = 0.3;

/** Canvas chrome that must not appear in the GIF (controls, minimap, panels, rail). */
const EXCLUDED_CLASSES = [
  "react-flow__panel",
  "react-flow__controls",
  "react-flow__minimap",
  "react-flow__attribution",
];

export type RecordingStatus = "idle" | "recording" | "encoding" | "done" | "error";

export interface FlowPlaybackRecorder {
  status: RecordingStatus;
  progress: number;
  totalSteps: number;
  error: string | null;
  record: (opts: {
    flow: Flow;
    speed: RecordingSpeed;
    reactFlowInstance: ReactFlowInstance;
  }) => Promise<Blob | null>;
  cancel: () => void;
}

interface CaptureTarget {
  element: HTMLElement;
  width: number;
  height: number;
  pixelRatio: number;
  backgroundColor: string;
  fontEmbedCSS: string;
}

interface Particle {
  path: Path2D;
  stroke: string;
  reverse: boolean;
}

interface GifFrame {
  canvas: HTMLCanvasElement;
  delay: number;
}

/**
 * Records a flow's playback as an animated GIF.
 *
 * The camera is framed once on every node the flow touches and held still
 * (`cameraLocked`), so frames line up and the eye follows the highlight, not
 * the camera. Each step is captured once with `html-to-image` (without the
 * particle), then the particle is drawn along the active edge in sub-frames —
 * the same motion as the live `flowParticle` CSS animation, which a still DOM
 * capture cannot see. Frames are encoded by `gif.js` in a web worker.
 *
 * Must be rendered inside a `FlowModeProvider`.
 */
export function useFlowPlaybackRecorder(): FlowPlaybackRecorder {
  const flowMode = useFlowMode();
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const flowModeRef = useRef(flowMode);
  flowModeRef.current = flowMode;

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const record = useCallback(
    async (opts: {
      flow: Flow;
      speed: RecordingSpeed;
      reactFlowInstance: ReactFlowInstance;
    }): Promise<Blob | null> => {
      const { flow, speed, reactFlowInstance } = opts;
      const mode = () => flowModeRef.current;
      const { setCameraLocked } = useFlowViewStore.getState();
      cancelRef.current = false;
      setError(null);
      setProgress(0);

      const stepDelay = RECORDING_SPEED_MS[speed];
      const path = planPlaybackPath(flow);
      setTotalSteps(path.length);

      if (path.length === 0) {
        setStatus("error");
        setError("Flow has no steps to record");
        return null;
      }

      setStatus("recording");
      const frames: GifFrame[] = [];
      setCameraLocked(true);

      try {
        mode().play(flow);
        await delay(OPEN_SETTLE_MS);
        await frameFlow(reactFlowInstance, flow);
        const target = await resolveCaptureTarget();
        // html-to-image often drops images/fonts on the very first pass; warm it up.
        await captureBase(target);

        for (let i = 0; i < path.length && !cancelRef.current; i++) {
          if (i > 0) {
            const advance = path[i - 1]!.advance;
            if (advance.kind === "branch") mode().chooseBranch(advance.index);
            else mode().goNext();
          }
          await nextPaint();
          await delay(STEP_SETTLE_MS);

          const hold = i === path.length - 1 ? stepDelay * LAST_STEP_HOLD_FACTOR : stepDelay;
          frames.push(...(await captureStep(target, hold)));
          setProgress(i + 1);
        }
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Frame capture failed");
        return null;
      } finally {
        mode().exitPlay();
        setCameraLocked(false);
      }

      if (cancelRef.current) {
        setStatus("idle");
        return null;
      }

      setStatus("encoding");
      try {
        const blob = await encodeGif(frames);
        setStatus("done");
        return blob;
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "GIF encoding failed");
        return null;
      }
    },
    [],
  );

  // Never leave the canvas stuck in a locked recording if the host unmounts.
  useEffect(
    () => () => {
      cancelRef.current = true;
      useFlowViewStore.getState().setCameraLocked(false);
    },
    [],
  );

  return { status, progress, totalSteps, error, record, cancel };
}

type Advance = { kind: "next" } | { kind: "branch"; index: number };

/**
 * The linear path recorded for a flow: from the entry step, follow `next`, or the
 * first branch of a condition. Stops at the end or on a revisit (loops).
 * Each entry knows how playback advances from it to the following entry.
 */
export function planPlaybackPath(flow: Flow): { stepId: string; advance: Advance }[] {
  const path: { stepId: string; advance: Advance }[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = flow.entryStepId ?? undefined;

  while (currentId && !visited.has(currentId)) {
    const step = getStepById(flow, currentId);
    if (!step) break;
    visited.add(currentId);
    if (isConditionStep(step)) {
      path.push({ stepId: currentId, advance: { kind: "branch", index: 0 } });
      currentId = step.branches?.[0]?.nextId;
    } else {
      path.push({ stepId: currentId, advance: { kind: "next" } });
      currentId = step.next ?? undefined;
    }
  }
  return path;
}

/**
 * Where the particle sits at `elapsedMs` into a step, as a canvas `lineDashOffset`.
 * Mirrors the `flowParticle` keyframes: dashoffset 0 → -cycle per period,
 * played backwards for a response.
 */
export function particleDashOffset(elapsedMs: number, reverse: boolean): number {
  const phase = (elapsedMs % FLOW_PARTICLE_DURATION_MS) / FLOW_PARTICLE_DURATION_MS;
  return -PARTICLE_CYCLE * (reverse ? 1 - phase : phase);
}

/**
 * The dash pattern for a particle drawn `scale` times bigger. Only the dash
 * grows; the cycle stays the live one (in flow units), so an edge carries as
 * many particles as it does live, moving at the same speed — scaling the gap
 * too would leave short edges empty for most of the period.
 */
export function particleDash(scale: number): [number, number] {
  const dash = Math.min(PARTICLE_DASH[0] * scale, PARTICLE_CYCLE / 2);
  return [dash, PARTICLE_CYCLE - dash];
}

/**
 * How much the particle pattern is scaled, in flow units, so that on screen it
 * looks as it does live at the reading zoom (never smaller than live).
 */
export function particleScale(zoom: number): number {
  return Math.max(1, (PARTICLE_EMPHASIS * READING_MAX_ZOOM) / (zoom || 1));
}

/** Frames every node the recorded path touches, once, without animation. */
async function frameFlow(instance: ReactFlowInstance, flow: Flow): Promise<void> {
  const ids = new Set<string>();
  for (const { stepId } of planPlaybackPath(flow)) {
    const step = getStepById(flow, stepId);
    if (step) for (const id of stepTargetIds(step, instance)) ids.add(id);
  }
  if (ids.size === 0) return;
  await instance.fitBounds(instance.getNodesBounds([...ids]), {
    padding: FLOW_FRAME_PADDING,
    duration: 0,
  });
  await nextPaint();
}

async function resolveCaptureTarget(): Promise<CaptureTarget> {
  const element = document.querySelector<HTMLElement>(".react-flow");
  if (!element) throw new Error("Canvas not found — is the diagram open?");

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) throw new Error("Canvas has no visible area");

  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const dpr = window.devicePixelRatio || 1;
  const pixelRatio = Math.min(dpr, MAX_PIXEL_RATIO, MAX_GIF_WIDTH / width);
  const fontEmbedCSS = await getFontEmbedCSS(element, { filter: captureFilter }).catch(() => "");

  return {
    element,
    width,
    height,
    pixelRatio,
    // GIF has no alpha channel: use the canvas' real background (light/dark theme).
    backgroundColor: resolveBackground(element),
    fontEmbedCSS,
  };
}

function captureBase(target: CaptureTarget): Promise<HTMLCanvasElement> {
  return toCanvas(target.element, {
    width: target.width,
    height: target.height,
    pixelRatio: target.pixelRatio,
    backgroundColor: target.backgroundColor,
    fontEmbedCSS: target.fontEmbedCSS,
    filter: captureFilter,
  });
}

/** One step: a still frame, or particle sub-frames over the step's duration. */
async function captureStep(target: CaptureTarget, holdMs: number): Promise<GifFrame[]> {
  const base = await captureBase(target);
  const particles = readParticles(target.element);
  if (particles.length === 0) return [{ canvas: base, delay: holdMs }];

  const transform = viewportTransform(target.element);
  const labelHoles = readLabelRects(target.element);
  const count = Math.max(1, Math.round(holdMs / SUBFRAME_MS));
  const frames: GifFrame[] = [];
  for (let k = 0; k < count; k++) {
    const canvas = document.createElement("canvas");
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(base, 0, 0);
    drawParticles(ctx, particles, transform, target.pixelRatio, labelHoles, k * SUBFRAME_MS);
    frames.push({ canvas, delay: SUBFRAME_MS });
  }
  return frames;
}

function readParticles(root: HTMLElement): Particle[] {
  return Array.from(root.querySelectorAll<SVGPathElement>("path[data-flow-particle]")).flatMap(
    (el) => {
      const d = el.getAttribute("d");
      if (!d) return [];
      return [
        {
          path: new Path2D(d),
          stroke: el.getAttribute("stroke") ?? "hsl(187 72% 51%)",
          reverse: el.getAttribute("data-flow-particle") === "response",
        },
      ];
    },
  );
}

/**
 * Edge label boxes, relative to the captured root. Live, the particle runs
 * under the labels (they are HTML above the edge SVG); the drawn particle is
 * clipped out of them to match.
 */
function readLabelRects(root: HTMLElement): DOMRect[] {
  const renderer = root.querySelector(".react-flow__edgelabel-renderer");
  if (!renderer) return [];
  const rootRect = root.getBoundingClientRect();
  // Labels are portalled a few levels down; each one is absolutely positioned.
  return Array.from(renderer.querySelectorAll<HTMLElement>("*")).flatMap((el) => {
    if (getComputedStyle(el).position !== "absolute") return [];
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return [];
    return [new DOMRect(r.left - rootRect.left, r.top - rootRect.top, r.width, r.height)];
  });
}

/** The flow → canvas transform: the React Flow viewport, relative to the captured root. */
function viewportTransform(root: HTMLElement): DOMMatrix {
  const viewport = root.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) return new DOMMatrix();
  const matrix = new DOMMatrix(getComputedStyle(viewport).transform);
  const rootRect = root.getBoundingClientRect();
  const parentRect = (viewport.parentElement ?? root).getBoundingClientRect();
  return new DOMMatrix()
    .translate(parentRect.left - rootRect.left, parentRect.top - rootRect.top)
    .multiply(matrix);
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  transform: DOMMatrix,
  pixelRatio: number,
  labelHoles: DOMRect[],
  elapsedMs: number,
): void {
  const zoom = Math.hypot(transform.a, transform.b) || 1;
  ctx.save();
  if (labelHoles.length > 0) {
    // Outer rect clockwise, holes counter-clockwise: with the nonzero rule,
    // overlapping (nested) label boxes stay cut out instead of toggling back in.
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const hole of labelHoles) {
      const x = hole.x * pixelRatio;
      const y = hole.y * pixelRatio;
      const w = hole.width * pixelRatio;
      const h = hole.height * pixelRatio;
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y);
      ctx.closePath();
    }
    ctx.clip("nonzero");
  }
  const scale = particleScale(zoom);
  ctx.setTransform(new DOMMatrix().scale(pixelRatio).multiply(transform));
  ctx.lineCap = "round";
  ctx.setLineDash(particleDash(scale));
  for (const particle of particles) {
    ctx.strokeStyle = particle.stroke;
    ctx.lineDashOffset = particleDashOffset(elapsedMs, particle.reverse);
    // Halo first, then the particle itself on top.
    ctx.globalAlpha = PARTICLE_GLOW_ALPHA;
    ctx.lineWidth = PARTICLE_WIDTH * scale * PARTICLE_GLOW_WIDTH;
    ctx.stroke(particle.path);
    ctx.globalAlpha = 1;
    ctx.lineWidth = PARTICLE_WIDTH * scale;
    ctx.stroke(particle.path);
  }
  ctx.restore();
}

function captureFilter(node: HTMLElement): boolean {
  if (typeof node.getAttribute === "function" && node.getAttribute("data-flow-particle")) {
    return false;
  }
  const classList = node.classList;
  if (!classList) return true;
  return !EXCLUDED_CLASSES.some((cls) => classList.contains(cls));
}

function resolveBackground(element: HTMLElement): string {
  let el: HTMLElement | null = element;
  while (el) {
    const color = getComputedStyle(el).backgroundColor;
    if (color && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color)) return color;
    el = el.parentElement;
  }
  return "#ffffff";
}

function encodeGif(frames: GifFrame[]): Promise<Blob> {
  if (frames.length === 0) return Promise.reject(new Error("No frames to encode"));
  const { width, height } = frames[0]!.canvas;

  return new Promise<Blob>((resolve, reject) => {
    const gif = new GIF({
      workerScript: gifWorkerUrl,
      workers: Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)),
      repeat: 0,
      // Diagrams are flat colors: no dithering (it adds speckle noise), and a
      // per-frame palette so step highlight colors stay accurate. `quality` is
      // the palette sampling step: 6 keeps the 5px particle's color (cyan /
      // green) while halving encode time versus 2 at 25fps.
      quality: 6,
      dither: false,
      width,
      height,
    });

    for (const frame of frames) {
      const ctx = frame.canvas.getContext("2d");
      if (!ctx) continue;
      gif.addFrame(ctx, { copy: true, delay: frame.delay });
    }

    gif.on("finished", (blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF encoding aborted")));
    try {
      gif.render();
    } catch (err) {
      reject(err instanceof Error ? err : new Error("GIF encoding failed"));
    }
  });
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
