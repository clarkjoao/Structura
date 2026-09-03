import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EdgeStyleDropdownValue } from "./edgeStyleMapping";

interface EdgeStyleOption {
  value: EdgeStyleDropdownValue;
  label: string;
  icon: string;
}

const EDGE_STYLE_OPTIONS: EdgeStyleOption[] = [
  { value: "straight", label: "edgeStraight", icon: "M 2 18 L 18 2" },
  { value: "bezier", label: "edgeBezier", icon: "M 2 18 C 2 2 18 2 18 2" },
  { value: "step", label: "edgeStep", icon: "M 2 18 H 10 V 2 H 18" },
  {
    value: "smoothstep",
    label: "edgeSmoothstep",
    icon: "M 2 18 C 8 18 8 2 18 2",
  },
];

interface EdgeStyleDropdownProps {
  currentStyle?: EdgeStyleDropdownValue;
  onChangeStyle: (style: EdgeStyleDropdownValue) => void;
}

export function EdgeStyleDropdown({ currentStyle, onChangeStyle }: EdgeStyleDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected =
    EDGE_STYLE_OPTIONS.find((o) => o.value === currentStyle) ?? EDGE_STYLE_OPTIONS[3];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1 h-6 px-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
        title={t("canvas.quickActions.edgeStyle")}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d={selected.icon} />
        </svg>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[120px]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {EDGE_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeStyle(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-xs transition-colors",
                selected.value === opt.value
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <svg
                width="20"
                height="12"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d={opt.icon} />
              </svg>
              <span>{t(`common.${opt.label}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
