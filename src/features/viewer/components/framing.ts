/** A node's measured size, as React Flow reports it once the node is drawn. */
type Measured = { width?: number; height?: number } | undefined;

/**
 * The sizes of the elements to frame, as one comparable value — or null while any of them on
 * the canvas is still unmeasured, or none is there yet. Framing waits until this is non-null
 * and the same on two reads in a row: React Flow leaves unmeasured nodes out of `fitView`, and
 * an edited element keeps its old size until it is measured again.
 */
export function framingSignature(
  ids: readonly string[],
  measuredOf: (id: string) => Measured | null,
): string | null {
  const sizes: string[] = [];
  for (const id of ids) {
    const measured = measuredOf(id);
    if (measured === null) continue; // not on the canvas
    if (measured?.width === undefined || measured.height === undefined) return null;
    sizes.push(`${id}:${measured.width}x${measured.height}`);
  }
  return sizes.length > 0 ? sizes.join("|") : null;
}
