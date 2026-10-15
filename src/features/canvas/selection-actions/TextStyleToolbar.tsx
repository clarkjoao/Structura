import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bold, ChevronDown, Italic, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  TEXT_COLORS,
  TEXT_SIZES,
  type TextColor,
  type TextComponent,
  type TextSize,
} from "@/features/diagram";
import { TEXT_COLOR_CSS } from "@/features/canvas/nodes/TextNode";
import { FloatingSelectionToolbar } from "./FloatingSelectionToolbar";

interface TextStyleToolbarProps {
  nodeId: string;
  component: TextComponent;
  onChange: (
    patch: Partial<Pick<TextComponent, "textSize" | "bold" | "italic" | "textColor">>,
  ) => void;
  onDelete: () => void;
}

const ICON_BUTTON =
  "flex h-7 min-w-7 items-center justify-center gap-1 rounded px-1.5 text-xs transition-colors";

/** Closes a dropdown on an outside press, as the other toolbar dropdowns do. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);
  return ref;
}

function SizeDropdown({
  value,
  onSelect,
}: {
  value: TextSize;
  onSelect: (size: TextSize) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={t("textStyle.size")}
        aria-label={t("textStyle.size")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(ICON_BUTTON, "text-foreground hover:bg-surface-hover")}
      >
        <span className="min-w-[4.5rem] text-left">{t(`textStyle.sizes.${value}`)}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[8rem] rounded-md border border-border bg-card py-1 shadow-lg">
          {TEXT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => {
                onSelect(size);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-2 py-1.5 text-xs transition-colors",
                size === value
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {t(`textStyle.sizes.${size}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorDropdown({
  value,
  onSelect,
}: {
  value: TextColor;
  onSelect: (color: TextColor) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={t("textStyle.color")}
        aria-label={t("textStyle.color")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(ICON_BUTTON, "hover:bg-surface-hover")}
      >
        <span
          className="h-4 w-4 rounded-full border border-border"
          style={{ background: TEXT_COLOR_CSS[value] }}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 flex gap-1 rounded-md border border-border bg-card p-1.5 shadow-lg">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={t(`textStyle.colors.${color}`)}
              aria-label={t(`textStyle.colors.${color}`)}
              onClick={() => {
                onSelect(color);
                setOpen(false);
              }}
              className={cn(
                "h-5 w-5 rounded-full border",
                color === value ? "border-primary ring-2 ring-primary/40" : "border-border",
              )}
              style={{ background: TEXT_COLOR_CSS[color] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The style bar of a selected text: size, colour, bold, italic. Only the closed
 * set the element stores — no fonts, no free colours.
 */
export function TextStyleToolbar({ nodeId, component, onChange, onDelete }: TextStyleToolbarProps) {
  const { t } = useTranslation();
  const bold = component.bold === true;
  const italic = component.italic === true;
  return (
    <FloatingSelectionToolbar nodeIds={[nodeId]}>
      <div
        className="flex items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-1 shadow-lg"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <SizeDropdown
          value={component.textSize ?? DEFAULT_TEXT_SIZE}
          onSelect={(textSize) => onChange({ textSize })}
        />
        <ColorDropdown
          value={component.textColor ?? DEFAULT_TEXT_COLOR}
          onSelect={(textColor) => onChange({ textColor })}
        />
        <button
          type="button"
          title={t("textStyle.bold")}
          aria-label={t("textStyle.bold")}
          aria-pressed={bold}
          onClick={() => onChange({ bold: bold ? undefined : true })}
          className={cn(
            ICON_BUTTON,
            bold ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-surface-hover",
          )}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={t("textStyle.italic")}
          aria-label={t("textStyle.italic")}
          aria-pressed={italic}
          onClick={() => onChange({ italic: italic ? undefined : true })}
          className={cn(
            ICON_BUTTON,
            italic ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-surface-hover",
          )}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          title={t("textStyle.delete")}
          aria-label={t("textStyle.delete")}
          onClick={onDelete}
          className={cn(
            ICON_BUTTON,
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </FloatingSelectionToolbar>
  );
}
