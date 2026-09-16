import { toast } from "sonner";
import {
  COMPONENT_TYPE_SVG,
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
  generateId,
  type Component,
  type Connection,
  type NodeLayout,
  type SvgComponent,
} from "@/features/diagram";
import { extractSvgMarkup } from "@/lib/clipboard";
import { readFileAsText } from "./read-file-as-text";
import { sanitizeSvg } from "./svg.sanitizer";
import { validateSvgSize } from "./svg.utils";
import { isRasterImageFile, rasterBlobToSvgMarkup } from "./wrapRasterAsSvg";

/** Longest edge after import — keeps huge artwork from swallowing the canvas. */
const SVG_MAX_EDGE = 800;

/**
 * Floor matching CardNode (`DEFAULT_NODE_W` × `DEFAULT_NODE_H`). Tiny viewBoxes
 * (icons at 16×16, 24×24, …) scale up uniformly until both edges clear the card.
 */
function clampSvgDisplaySize(width: number, height: number): { width: number; height: number } {
  let nextW = Math.max(1, width);
  let nextH = Math.max(1, height);

  if (nextW < DEFAULT_NODE_W || nextH < DEFAULT_NODE_H) {
    const grow = Math.max(DEFAULT_NODE_W / nextW, DEFAULT_NODE_H / nextH);
    nextW *= grow;
    nextH *= grow;
  }

  if (nextW > SVG_MAX_EDGE || nextH > SVG_MAX_EDGE) {
    const shrink = Math.min(SVG_MAX_EDGE / nextW, SVG_MAX_EDGE / nextH);
    nextW *= shrink;
    nextH *= shrink;
  }

  return { width: Math.round(nextW), height: Math.round(nextH) };
}

/**
 * Validate + sanitise clipboard/file SVG markup. Toasts on failure.
 *
 * @example
 * const clean = prepareImportedSvgMarkup(raw, t);
 * if (!clean) return;
 */
export function prepareImportedSvgMarkup(
  svgContent: string,
  translate: (key: string) => string,
): string | null {
  const candidate = extractSvgMarkup(svgContent) ?? svgContent.trim();
  const validation = validateSvgSize(candidate);
  if (!validation.valid) {
    if (validation.reason === "too_large") {
      toast.error(translate("icons.svgTooLarge"));
    } else {
      toast.error(translate("icons.svgDimensionExceeded"));
    }
    return null;
  }
  const sanitized = sanitizeSvg(candidate);
  if (sanitized === null) {
    toast.error(translate("icons.invalidSvg"));
    return null;
  }
  return sanitized;
}

/**
 * Prefer viewBox, then width/height attrs. Floor = CardNode size; ceiling = 800
 * on the long edge. Aspect ratio is preserved.
 */
export function readSvgDisplaySize(svgMarkup: string): { width: number; height: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  // Default: square card-width box when markup has no measurable size.
  let width = DEFAULT_NODE_W;
  let height = DEFAULT_NODE_W;
  if (!svgEl) return clampSvgDisplaySize(width, height);

  const viewBox = svgEl.getAttribute("viewBox")?.trim().split(/[\s,]+/);
  if (viewBox && viewBox.length === 4) {
    const viewWidth = parseFloat(viewBox[2] ?? "");
    const viewHeight = parseFloat(viewBox[3] ?? "");
    if (viewWidth > 0) width = viewWidth;
    if (viewHeight > 0) height = viewHeight;
  } else {
    const attrWidth = parseFloat(svgEl.getAttribute("width") ?? "");
    const attrHeight = parseFloat(svgEl.getAttribute("height") ?? "");
    if (attrWidth > 0) width = attrWidth;
    if (attrHeight > 0) height = attrHeight;
  }

  return clampSvgDisplaySize(width, height);
}

export function isSvgFile(file: File): boolean {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

export function isImportableCanvasImageFile(file: File): boolean {
  return isSvgFile(file) || isRasterImageFile(file);
}

export function svgNodeNameFromFile(file: File): string {
  const base = file.name.replace(/\.(svg|png|jpe?g)$/i, "").trim();
  return base || "SVG";
}

/**
 * Read a dropped File into SVG markup (native SVG text, or PNG/JPG wrapped
 * with a base64 `<image>`).
 */
export async function fileToSvgMarkup(file: File): Promise<string | null> {
  if (isSvgFile(file)) {
    try {
      return await readFileAsText(file);
    } catch {
      return null;
    }
  }
  if (isRasterImageFile(file)) {
    return rasterBlobToSvgMarkup(file, file.type || undefined);
  }
  return null;
}

/**
 * Build a canvas `svg` component + layout box ready for `importDrawioResult`.
 */
export function buildSvgCanvasImport(
  cleanMarkup: string,
  position: { x: number; y: number },
  name = "SVG",
): { component: SvgComponent; layout: NodeLayout } {
  const id = generateId("el");
  const { width, height } = readSvgDisplaySize(cleanMarkup);
  const component: SvgComponent = {
    id,
    name,
    description: "",
    parentId: null,
    type: COMPONENT_TYPE_SVG,
    svgContent: cleanMarkup,
  };
  return {
    component,
    layout: { elementId: id, x: position.x, y: position.y, width, height },
  };
}

type ImportDrawioResultFn = (
  components: Component[],
  connections: Connection[],
  layouts: NodeLayout[],
) => string[];

/** Sanitise markup and insert one svg node; returns the new id or null. */
export function importSvgMarkupToCanvas(params: {
  rawSvg: string;
  position: { x: number; y: number };
  name?: string;
  importDrawioResult: ImportDrawioResultFn;
  translate: (key: string) => string;
}): string | null {
  const clean = prepareImportedSvgMarkup(params.rawSvg, params.translate);
  if (!clean) return null;
  const { component, layout } = buildSvgCanvasImport(clean, params.position, params.name);
  const newIds = params.importDrawioResult([component], [], [layout]);
  return newIds[0] ?? null;
}
