/**
 * Label offset along the path: the projection's stamp (`data.layoutLabelOffset`,
 * from `diagram.edgeLayouts`) → the legacy `Connection.style.labelPosition`.
 * A `null` stamp means the diagram has no offset for the edge.
 *
 * Waypoints need no resolver: `useControlPoints` / `useSegmentDrag` hand back
 * a gesture's draft, or the resting points from the edge's data.
 *
 * @example
 * resolveLabelOffset({ layoutLabelOffset: null, legacyLabelPosition: 0.8 }); // 0.8
 */
export function resolveLabelOffset(params: {
  layoutLabelOffset: number | null | undefined;
  legacyLabelPosition: number | undefined;
}): number | undefined {
  if (params.layoutLabelOffset === null || params.layoutLabelOffset === undefined) {
    return params.legacyLabelPosition;
  }
  return params.layoutLabelOffset;
}
