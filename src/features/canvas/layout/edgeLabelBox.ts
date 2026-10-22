import type { LayoutEdge } from "./contract";

/*
 * Estimated size of the pill `edges/components/EdgeLabel.tsx` draws, so ELK can
 * reserve room for it. Estimated rather than measured because the layout is
 * pure (no DOM); the numbers mirror that component's classes:
 *   - label: `text-[10px] font-medium`, `max-w-[160px] truncate`
 *   - technology: `font-mono text-[9px]`, `px-1`, `mt-0.5`, on a line of its own
 *   - pill: `px-2 py-1`, 1px border
 * A little generous on purpose: an over-estimate costs some whitespace, an
 * under-estimate puts the pill back on top of an edge.
 */
const LABEL_CHAR_WIDTH = 6;
const LABEL_MAX_WIDTH = 160;
const LABEL_LINE_HEIGHT = 15;
const TECH_CHAR_WIDTH = 5.5;
const TECH_PADDING_X = 8;
const TECH_LINE_HEIGHT = 16;
const PILL_PADDING_X = 18;
const PILL_PADDING_Y = 10;

/**
 * The box ELK should reserve for a connection's label, or `undefined` when the
 * canvas draws no label for it.
 *
 * @example
 * edgeLabelBox("reads", "JDBC") // { text: "reads", width: ..., height: ... }
 */
export function edgeLabelBox(
  label: string | undefined,
  technology?: string,
): LayoutEdge["labelBox"] {
  // `label` is typed as required, but a connection from an older import or a
  // hand-built fixture can lack it, and a throw here aborts the whole layout.
  const text = label?.trim() ?? "";
  const tech = technology?.trim() ?? "";
  if (text.length === 0 && tech.length === 0) return undefined;

  const labelWidth = Math.min(LABEL_MAX_WIDTH, text.length * LABEL_CHAR_WIDTH);
  const techWidth = tech.length > 0 ? tech.length * TECH_CHAR_WIDTH + TECH_PADDING_X : 0;
  const lines =
    (text.length > 0 ? LABEL_LINE_HEIGHT : 0) + (tech.length > 0 ? TECH_LINE_HEIGHT : 0);

  return {
    // ELK drops a label with empty text, so a technology-only pill names itself by it.
    text: text.length > 0 ? text : tech,
    width: Math.ceil(Math.max(labelWidth, techWidth) + PILL_PADDING_X),
    height: lines + PILL_PADDING_Y,
  };
}
