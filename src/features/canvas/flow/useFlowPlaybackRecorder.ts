import { useCallback, useEffect, useRef, useState } from "react";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import GIF from "gif.js";
import gifWorkerUrl from "gif.js/dist/gif.worker.js?url";
import type { Flow } from "@/features/diagram";
import { getStepById, isConditionStep } from "@/features/diagram";
import { useFlowMode } from "./FlowModeContext";

export type RecordingSpeed = "slow" | "normal" | "fast";

export const RECORDING_SPEED_MS: Record<RecordingSpeed, number> = {
  slow: 1500,
  normal: 1000,
  fast: 500,
};

/** Max output width in pixels (design: 4096px cap). */
const MAX_GIF_WIDTH = 4096;
/** Upper bound on the capture pixel ratio — GIF size grows with the square of it. */
const MAX_PIXEL_RATIO = 2;
/** Time for the playback camera to settle before capturing the first frame. */
const SETTLE_MS = 450;
/** The last frame is held longer so the loop restart is readable. */
const LAST_FRAME_HOLD_FACTOR = 2;

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
  record: (opts: { flow: Flow; speed: RecordingSpeed }) => Promise<Blob | null>;
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

/**
 * Records a flow's playback as an animated GIF framed on the current viewport.
 *
 * Drives playback through `useFlowMode` (play → goNext / chooseBranch → exitPlay),
 * rasterizes the canvas after each step with `html-to-image`, and encodes the
 * frames with `gif.js` in a web worker. Everything runs client-side.
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
    async (opts: { flow: Flow; speed: RecordingSpeed }): Promise<Blob | null> => {
      const { flow, speed } = opts;
      const mode = () => flowModeRef.current;
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
      const frames: HTMLCanvasElement[] = [];

      try {
        const target = await resolveCaptureTarget();

        mode().play(flow);
        await delay(SETTLE_MS);
        // html-to-image often drops images/fonts on the very first pass; warm it up.
        await captureFrame(target);
        frames.push(await captureFrame(target));
        setProgress(1);

        for (let i = 1; i < path.length && !cancelRef.current; i++) {
          const advance = path[i - 1]!.advance;
          if (advance.kind === "branch") mode().chooseBranch(advance.index);
          else mode().goNext();

          await delay(stepDelay);
          frames.push(await captureFrame(target));
          setProgress(i + 1);
        }
      } catch (err) {
        mode().exitPlay();
        setStatus("error");
        setError(err instanceof Error ? err.message : "Frame capture failed");
        return null;
      }

      mode().exitPlay();

      if (cancelRef.current) {
        setStatus("idle");
        return null;
      }

      setStatus("encoding");
      try {
        const blob = await encodeGif(frames, stepDelay);
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

  // Never leave the canvas stuck in playback if the host unmounts mid-recording.
  useEffect(
    () => () => {
      cancelRef.current = true;
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

async function resolveCaptureTarget(): Promise<CaptureTarget> {
  const element = document.querySelector<HTMLElement>(".react-flow");
  if (!element) throw new Error("Canvas not found — is the diagram open?");

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) throw new Error("Canvas has no visible area");

  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const dpr = window.devicePixelRatio || 1;
  const pixelRatio = Math.min(dpr, MAX_PIXEL_RATIO, MAX_GIF_WIDTH / width);

  const filter = filterChrome;
  const fontEmbedCSS = await getFontEmbedCSS(element, { filter }).catch(() => "");

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

function captureFrame(target: CaptureTarget): Promise<HTMLCanvasElement> {
  return toCanvas(target.element, {
    width: target.width,
    height: target.height,
    pixelRatio: target.pixelRatio,
    backgroundColor: target.backgroundColor,
    fontEmbedCSS: target.fontEmbedCSS,
    filter: filterChrome,
  });
}

function filterChrome(node: HTMLElement): boolean {
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

function encodeGif(frames: HTMLCanvasElement[], stepDelay: number): Promise<Blob> {
  if (frames.length === 0) return Promise.reject(new Error("No frames to encode"));
  const { width, height } = frames[0]!;

  return new Promise<Blob>((resolve, reject) => {
    const gif = new GIF({
      workerScript: gifWorkerUrl,
      workers: Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)),
      repeat: 0,
      // Diagrams are flat colors: no dithering (it adds speckle noise), and a
      // per-frame palette so step highlight colors stay accurate.
      quality: 10,
      dither: false,
      width,
      height,
    });

    frames.forEach((canvas, index) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const isLast = index === frames.length - 1;
      gif.addFrame(ctx, {
        copy: true,
        delay: isLast ? stepDelay * LAST_FRAME_HOLD_FACTOR : stepDelay,
      });
    });

    gif.on("finished", (blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF encoding aborted")));
    try {
      gif.render();
    } catch (err) {
      reject(err instanceof Error ? err : new Error("GIF encoding failed"));
    }
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
