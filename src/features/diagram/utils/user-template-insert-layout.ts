
export interface UserTemplateLayoutInput {
  _relX?: number;
  _relY?: number;
  
  x?: number;
  y?: number;
  parentIndex?: number;
  width?: number;
  height?: number;
}

export function readTemplateRelativeOffsets(
  entry: UserTemplateLayoutInput,
): { relX: number; relY: number } {
  const relX =
    typeof entry._relX === "number"
      ? entry._relX
      : typeof entry.x === "number"
        ? entry.x
        : 0;
  const relY =
    typeof entry._relY === "number"
      ? entry._relY
      : typeof entry.y === "number"
        ? entry.y
        : 0;
  return { relX, relY };
}

export function computeUserTemplateNodeLayouts(
  templateComponents: ReadonlyArray<UserTemplateLayoutInput>,
  insertionPoint: { x: number; y: number },
): Array<{ x: number; y: number; width?: number; height?: number }> {
  return templateComponents.map((c) => {
    const { relX, relY } = readTemplateRelativeOffsets(c);
    const parentIdx = c.parentIndex;
    const isChild =
      parentIdx !== undefined &&
      Number.isInteger(parentIdx) &&
      parentIdx >= 0 &&
      parentIdx < templateComponents.length;

    let x: number;
    let y: number;
    if (isChild) {
      x = relX;
      y = relY;
    } else {
      x = insertionPoint.x + relX;
      y = insertionPoint.y + relY;
    }

    const layout: { x: number; y: number; width?: number; height?: number } = { x, y };
    if (typeof c.width === "number") layout.width = c.width;
    if (typeof c.height === "number") layout.height = c.height;
    return layout;
  });
}
