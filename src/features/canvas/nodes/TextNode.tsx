import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  type TextColor,
  type TextSize,
} from "@/features/diagram/model/text-style";
import { ELEMENT_SIZE_LIMITS } from "./elementSizeLimits";

export type TextNodeData = {
  elementId: string;
  /** The text itself. */
  name: string;
  textSize?: TextSize;
  bold?: boolean;
  italic?: boolean;
  textColor?: TextColor;
  isSelected?: boolean;
};

export const TEXT_FONT_PX: Readonly<Record<TextSize, number>> = {
  sm: 14,
  md: 18,
  lg: 28,
  xl: 44,
};

export const TEXT_COLOR_CSS: Readonly<Record<TextColor, string>> = {
  default: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
  blue: "hsl(217 91% 50%)",
  green: "hsl(142 71% 35%)",
  amber: "hsl(32 95% 44%)",
  red: "hsl(0 72% 51%)",
};

/**
 * Free text: no box, no fill, no handles. It is a decoration written while
 * planning, so it carries only the closed set of styles on `TextComponent`.
 */
const TextNode = memo(({ data: d, selected }: NodeProps<Node<TextNodeData>>) => {
  const isSelected = !!(selected || d.isSelected);
  const limits = ELEMENT_SIZE_LIMITS.text;
  return (
    <>
      <NodeResizer
        minWidth={limits.minWidth}
        minHeight={limits.minHeight}
        isVisible={isSelected}
        lineClassName="!border-primary"
        handleClassName="!w-2 !h-2 !bg-primary !border-background !rounded-sm"
      />
      <div
        className={`h-full w-full whitespace-pre-wrap break-words leading-tight ${
          isSelected ? "outline outline-2 outline-primary" : ""
        }`}
        style={{
          fontSize: TEXT_FONT_PX[d.textSize ?? DEFAULT_TEXT_SIZE],
          fontWeight: d.bold ? 700 : 500,
          fontStyle: d.italic ? "italic" : "normal",
          color: TEXT_COLOR_CSS[d.textColor ?? DEFAULT_TEXT_COLOR],
        }}
      >
        {d.name}
      </div>
    </>
  );
});

TextNode.displayName = "TextNode";

export default TextNode;
