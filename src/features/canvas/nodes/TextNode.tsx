import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { NodeResizeControl, type Node, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { useDiagramActions } from "@/features/diagram";
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  type TextColor,
  type TextSize,
} from "@/features/diagram/model/text-style";
import { KEY, keyIs } from "@/lib/core/keyboard";
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
  /** Read surfaces: the text is read, not written. */
  controlsDisabled?: boolean;
  onInlineEditingChange?: (editing: boolean) => void;
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

function typography(d: TextNodeData): CSSProperties {
  return {
    fontSize: TEXT_FONT_PX[d.textSize ?? DEFAULT_TEXT_SIZE],
    fontWeight: d.bold ? 700 : 500,
    fontStyle: d.italic ? "italic" : "normal",
    color: TEXT_COLOR_CSS[d.textColor ?? DEFAULT_TEXT_COLOR],
    lineHeight: 1.2,
  };
}

const RESIZE_CONTROL_STYLE: CSSProperties = {
  width: 8,
  height: 8,
  background: "hsl(var(--primary))",
  border: "1px solid hsl(var(--background))",
  borderRadius: 2,
};

/**
 * Free text: no box, no fill, no handles. A decoration written while planning,
 * so it carries only the closed set of styles on `TextComponent`.
 *
 * Its height is its content's — only the width is the author's, which is why
 * the resize controls are the two horizontal ones. A double click edits it in
 * place; a text with nothing in it is removed rather than left invisible.
 */
const TextNode = memo(({ data: d, selected }: NodeProps<Node<TextNodeData>>) => {
  const { t } = useTranslation();
  const { updateComponent, removeComponent } = useDiagramActions();
  const isSelected = !!(selected || d.isSelected);
  const editable = !d.controlsDisabled;
  const limits = ELEMENT_SIZE_LIMITS.text;
  const onInlineEditingChange = d.onInlineEditingChange;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipCommitRef = useRef(false);
  const isEmpty = d.name.trim().length === 0;

  const startEdit = useCallback(() => {
    if (!editable) return;
    setDraft(d.name);
    onInlineEditingChange?.(true);
    setIsEditing(true);
  }, [editable, d.name, onInlineEditingChange]);

  // A text that was just created has nothing in it: go straight to typing.
  useEffect(() => {
    if (isSelected && isEmpty && editable && !isEditing) startEdit();
    // Opening is a reaction to the empty selected state, not to the callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected, isEmpty, editable]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [isEditing]);

  // Grow the field with what is typed, as the finished text will.
  useLayoutEffect(() => {
    const field = textareaRef.current;
    if (!isEditing || !field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [isEditing, draft, d.textSize, d.bold]);

  const finishEdit = useCallback(
    (next: string | null) => {
      setIsEditing(false);
      onInlineEditingChange?.(false);
      if (next === null) {
        // Cancelled: a text that never had content goes away with it.
        if (isEmpty) removeComponent(d.elementId);
        return;
      }
      if (next.trim().length === 0) {
        removeComponent(d.elementId);
        return;
      }
      if (next !== d.name) updateComponent(d.elementId, { name: next });
    },
    [d.elementId, d.name, isEmpty, onInlineEditingChange, removeComponent, updateComponent],
  );

  const handleBlur = useCallback(() => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    finishEdit(draft);
  }, [draft, finishEdit]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (keyIs(event, KEY.ESCAPE)) {
        skipCommitRef.current = true;
        finishEdit(null);
      }
      event.stopPropagation();
    },
    [finishEdit],
  );

  return (
    <>
      {isSelected && !isEditing && editable && (
        <>
          <NodeResizeControl
            position="left"
            resizeDirection="horizontal"
            minWidth={limits.minWidth}
            style={RESIZE_CONTROL_STYLE}
          />
          <NodeResizeControl
            position="right"
            resizeDirection="horizontal"
            minWidth={limits.minWidth}
            style={RESIZE_CONTROL_STYLE}
          />
        </>
      )}
      <div
        className={`w-full whitespace-pre-wrap break-words ${
          isSelected ? "outline outline-2 outline-primary" : ""
        }`}
        style={typography(d)}
        onDoubleClick={startEdit}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            rows={1}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={t("textNode.placeholder")}
            aria-label={t("textNode.ariaLabel")}
            className="nodrag nopan block w-full resize-none overflow-hidden border-none bg-transparent p-0 outline-none"
            style={{ font: "inherit", color: "inherit", lineHeight: "inherit" }}
          />
        ) : (
          d.name
        )}
      </div>
    </>
  );
});

TextNode.displayName = "TextNode";

export default TextNode;
