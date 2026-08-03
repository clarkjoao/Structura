/**
 * Visual self-check — captures the rendered canvas and returns it for evaluation.
 *
 * The deterministic validators catch structural and geometric problems before the canvas
 * renders. After commit, this captures what the browser actually drew so the model (or the
 * user) can spot the things validators cannot:
 * - Label legibility at the rendered size (clipped by CSS overflow, not just by pixel count)
 * - Visual balance and density across the canvas
 * - Whether the diagram reads as an architecture diagram, not a box-and-arrow dump
 * - Missing context (should an external system be named but isn't?)
 *
 * Usage:
 * ```
 * // After commit, when the user asks for a visual review:
 * const blob = await captureCanvas(diagramEl, { scale: 2 });
 * const dataUrl = await blobToDataUrl(blob);
 * // dataUrl can be displayed in the UI or sent to the model for evaluation.
 * ```
 *
 * Capturing requires a DOM element. In Node.js (tests, CI) this is unavailable and
 * `captureCanvas` returns null rather than throwing.
 */

export interface CaptureOptions {
  /** Pixel ratio for the capture. 2 = retina quality. Default 1. */
  scale?: number;
  /** Filter function — return false to exclude an element from the capture. */
  filter?: (node: HTMLElement) => boolean;
  /** Background colour override. Default transparent. */
  backgroundColor?: string;
}

export interface CaptureResult {
  /** data:image/png;base64,... */
  dataUrl: string;
  width: number;
  height: number;
  /** How many ms the capture took. */
  durationMs: number;
}

/**
 * Returns true when `captureCanvas` can run — false in Node.js and JSDOM.
 * Use this to guard the capture call and skip it gracefully in test environments.
 */
export function isCaptureSupported(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

/**
 * Blobs to data URLs for transport over JSON (model evaluation).
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Captures a DOM element as a PNG blob.
 *
 * Requires html-to-image (loaded dynamically to keep this out of the server bundle).
 * Returns null when the DOM is unavailable (Node.js, JSDOM) rather than throwing,
 * so the call site does not need to be guarded with `isCaptureSupported()`.
 */
export async function captureCanvas(
  element: HTMLElement,
  options: CaptureOptions = {},
): Promise<CaptureResult | null> {
  if (!isCaptureSupported()) return null;

  const t0 = performance.now();

  // html-to-image is already a dep of the app (used by the share/export feature).
  const { toPng } = await import("html-to-image");

  const dataUrl = await toPng(element, {
    pixelRatio: options.scale ?? 1,
    backgroundColor: options.backgroundColor ?? undefined,
    filter: options.filter ?? ((node: Element) => node.tagName !== "BUTTON"),
  });

  // Extract pixel dimensions from the PNG data URL without parsing the whole file.
  // PNG IHDR chunk: magic (8 bytes) + length (4) + "IHDR" (4) + width (4) + height (4) at offset 16.
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = dv.getUint32(16, false);
  const height = dv.getUint32(20, false);

  return {
    dataUrl,
    width,
    height,
    durationMs: Math.round(performance.now() - t0),
  };
}

/**
 * Visual quality assessment prompt — appended to the system message when the model is asked
 * to evaluate a rendered canvas.
 *
 * The model evaluates without being told what the IR said — this is an independent
 * visual read, not a confirmation check.
 */
export function visualReviewPrompt(): string {
  return `
## Visual self-check

You are reviewing a rendered architecture diagram. The canvas is shown below.

Evaluate it honestly. Think about what you would say to the person who drew it.

**Evaluate each of:**

1. **Balance** — Is the diagram roughly centred, or is it skewed to one side?
2. **Density** — Does it feel crowded, sparse, or about right?
3. **Legibility** — Are all labels readable? Are any truncated or overlapping visually (not just in the IR)?
4. **Clarity** — Can you trace the main flow with your eyes without ambiguity?
5. **Vocabulary** — Are the shapes consistent? (e.g. AWS services use AWS icons, C4 people use person shapes)
6. **Missing context** — Is there anything an architect would expect in a diagram of this kind that is absent?

**Respond with this structure:**
\`\`\`
VERDICT: PASS | MARGINAL | FAIL
SCORE: <1-10>

STRENGTHS:
- ...

CONCERNS:
- ...

SUGGESTIONS:
- ...
\`\`\`

If VERDICT is FAIL or MARGINAL, the suggestions should be specific enough to turn into IR edits.
`;
}
