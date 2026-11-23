import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { kindOverlayFor } from "@/features/diagram-kinds/overlay";
import {
  OVERLAY_LABEL_DEPTH,
  overlayCurvePoints,
  overlayRect,
} from "@/features/diagram-kinds/overlay.geometry";
import i18n from "@/infrastructure/i18n";
import type { ExportDecorations } from "../export-core";

/**
 * The diagram kind's overlay as draw.io decorations (spec guided-overlay-fit-export):
 * each phase a labelled rectangle, each separator a dashed line, the emotion curve
 * one polyline. Undefined outside kind mode, or when the kind draws nothing.
 */
export function kindExportDecorations(diagram: DiagramModel): ExportDecorations | undefined {
  const overlay = kindOverlayFor(diagram);
  if (!overlay) return undefined;
  const rects = overlay.segments.map((segment) => ({
    id: `structura-phase-${segment.id}`,
    label: segment.label,
    ...overlayRect(
      overlay,
      segment.from + 2,
      Math.max(0, segment.to - segment.from - 4),
      overlay.at,
      OVERLAY_LABEL_DEPTH,
    ),
  }));
  const separators = overlay.separators.map((separator, index) => {
    const start = overlayRect(overlay, separator.along, 0, separator.from, 0);
    const end = overlayRect(overlay, separator.along, 0, separator.to, 0);
    return {
      id: `structura-phase-separator-${index}`,
      points: [
        { x: start.x, y: start.y },
        { x: end.x, y: end.y },
      ],
      dashed: true,
    };
  });
  for (const line of overlay.lines ?? []) {
    const start = overlayRect(overlay, line.from, 0, line.across, 0);
    const end = overlayRect(overlay, line.to, 0, line.across, 0);
    separators.push({
      id: `structura-line-${line.id}`,
      points: [
        { x: start.x, y: start.y },
        { x: end.x, y: end.y },
      ],
      dashed: true,
    });
  }
  const curve = overlayCurvePoints(overlay);
  const lines =
    curve.length > 1
      ? [
          ...separators,
          { id: "structura-emotion-curve", points: curve.map(({ x, y }) => ({ x, y })) },
        ]
      : separators;
  if (rects.length === 0 && lines.length === 0) return undefined;
  return { layerName: i18n.t("diagramKinds.overlay.exportLayer"), rects, lines };
}
