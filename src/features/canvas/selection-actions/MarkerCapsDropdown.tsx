import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import type { EdgeMarker } from "@/features/diagram";
import { cn } from "@/lib/utils";

const MARKER_OPTIONS: { value: EdgeMarker; labelKey: string }[] = [
  { value: "none" as EdgeMarker, labelKey: "markerNone" },
  { value: "arrow" as EdgeMarker, labelKey: "markerArrow" },
  { value: "arrow-closed" as EdgeMarker, labelKey: "markerArrowClosed" },
];

interface MarkerCapsDropdownProps {
  currentCap?: EdgeMarker;
  onChangeCap: (cap: EdgeMarker) => void;
  capType: "start" | "end";
}

export function MarkerCapsDropdown({ currentCap, onChangeCap, capType }: MarkerCapsDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = MARKER_OPTIONS.find((o) => o.value === currentCap) ?? MARKER_OPTIONS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const labelKey =
    capType === "start" ? "canvas.quickActions.markerStart" : "canvas.quickActions.markerEnd";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-0.5 h-6 px-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors text-[10px]"
        title={t(labelKey)}
      >
        <span>{t(`common.${selected.labelKey}`)}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[100px]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {MARKER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeCap(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-2 py-1.5 text-xs transition-colors",
                selected.value === opt.value
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {t(`common.${opt.labelKey}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
