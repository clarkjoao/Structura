import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Droplets, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PANEL_OPACITY } from "../constants/panel.constants";

interface OpacityControlProps {
  value: number;
  onChange: (value: number) => void;
  onReset?: () => void;
}

export function OpacityControl({ value, onChange, onReset }: OpacityControlProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isModified = value !== DEFAULT_PANEL_OPACITY;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleReset = () => {
    onReset?.();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex items-center gap-1 h-6 px-1.5 rounded transition-colors",
          isModified
            ? "text-foreground bg-primary/10 hover:bg-primary/20"
            : "text-muted-foreground hover:text-foreground hover:bg-surface-hover",
        )}
        title={t("canvas.quickActions.opacity")}
        aria-label={t("canvas.quickActions.opacity")}
      >
        <Droplets className="h-3.5 w-3.5" />
        <span className="text-[10px] tabular-nums">{value}%</span>
      </button>

      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-card border border-border rounded-md shadow-lg p-2.5 min-w-[140px]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              {t("canvas.quickActions.opacity")}
            </span>
            <span className="text-xs font-medium tabular-nums ml-auto">{value}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
            style={{ touchAction: "none" }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">0%</span>
            <span className="text-[9px] text-muted-foreground">100%</span>
          </div>
          {onReset && isModified && (
            <button
              type="button"
              title={t("colorSwatches.default")}
              aria-label={t("colorSwatches.default")}
              onClick={handleReset}
              className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded transition-colors border-t border-border pt-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              {t("colorSwatches.default")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
