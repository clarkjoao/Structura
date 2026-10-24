import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { cn } from "@/lib/utils";
import { PANEL_INPUT_CLASS, PANEL_LABEL_CLASS } from "./fieldStyles";

export interface AdvancedFooterProps {
  id: string;
  /** X/Y/W/H — the position section, when the element has a layout. */
  children?: ReactNode;
  /** Present for an element with a stacking order. */
  zIndex?: number;
  onCommitZIndex?: (zIndex: number) => void;
}

/** The folded "Advanced" footer: ID, X/Y/W/H and z-index — collapsed until asked for. */
export function AdvancedFooter({ id, children, zIndex, onCommitZIndex }: AdvancedFooterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [zInput, setZInput] = useState(String(zIndex ?? 0));
  const zEditingRef = useRef(false);

  useEffect(() => {
    if (!zEditingRef.current) setZInput(String(zIndex ?? 0));
  }, [zIndex]);

  const commitZ = () => {
    zEditingRef.current = false;
    const parsed = Number(zInput.trim());
    if (zInput.trim() === "" || !Number.isFinite(parsed)) {
      setZInput(String(zIndex ?? 0));
      return;
    }
    if (Math.round(parsed) !== (zIndex ?? 0)) onCommitZIndex?.(parsed);
  };

  return (
    <footer className="shrink-0 border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {t("panelShell.advanced")}
      </button>
      {open && (
        <div className="max-h-[40vh] space-y-3 overflow-y-auto px-4 pb-4">
          <div>
            <span className={PANEL_LABEL_CLASS}>{t("elementPanel.idLabel")}</span>
            <button
              type="button"
              title={t("panelShell.copyId")}
              onClick={() => {
                void navigator.clipboard?.writeText(id);
                toast.success(t("panelShell.idCopied"));
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md bg-secondary px-2.5 py-1.5 text-left font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="truncate">{id}</span>
              <Copy className="h-3 w-3 shrink-0" />
            </button>
          </div>
          {children}
          {onCommitZIndex && (
            <div>
              <label className={PANEL_LABEL_CLASS} htmlFor={`z-${id}`}>
                {t("panelShell.zIndex")}
              </label>
              <input
                id={`z-${id}`}
                type="text"
                inputMode="numeric"
                value={zInput}
                className={PANEL_INPUT_CLASS}
                onFocus={() => {
                  zEditingRef.current = true;
                }}
                onChange={(event) => setZInput(event.target.value)}
                onBlur={commitZ}
                onKeyDown={(event) => {
                  if (keyIs(event, KEY.ENTER)) event.currentTarget.blur();
                }}
              />
            </div>
          )}
        </div>
      )}
    </footer>
  );
}
