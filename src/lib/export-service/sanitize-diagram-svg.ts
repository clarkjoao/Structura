import type { Diagram, IconDefinition } from "@/features/diagram";
import { isSvgIcon } from "@/features/diagram";
import { sanitizeSvg } from "@/features/canvas/utils/svg.sanitizer";

const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>';

/** The icon with its SVG sanitized, or `null` when the markup is not a valid SVG. */
export function sanitizeSvgIcon(icon: IconDefinition): IconDefinition | null {
  if (!isSvgIcon(icon)) return icon;
  const clean = sanitizeSvg(icon.source.svgContent);
  return clean === null ? null : { ...icon, source: { kind: "svg", svgContent: clean } };
}

/**
 * Sanitizes every user-supplied SVG in a diagram that arrives from outside (file, folder, link).
 *
 * Svg components whose markup is not a valid SVG keep their card but render an empty drawing;
 * icon-library entries that are not valid SVGs are dropped. The input is not mutated.
 */
export function sanitizeDiagramSvg(diagram: Diagram): Diagram {
  const snapshot = diagram.snapshot;
  if (!snapshot) return diagram;

  const components = { ...snapshot.components };
  for (const [id, component] of Object.entries(components)) {
    if (component?.type === "svg" && typeof component.svgContent === "string") {
      components[id] = { ...component, svgContent: sanitizeSvg(component.svgContent) ?? EMPTY_SVG };
    }
  }

  const iconLibrary: Record<string, IconDefinition> = {};
  for (const [id, icon] of Object.entries(snapshot.iconLibrary ?? {})) {
    const clean = sanitizeSvgIcon(icon);
    if (clean) iconLibrary[id] = clean;
  }

  return { ...diagram, snapshot: { ...snapshot, components, iconLibrary } };
}
