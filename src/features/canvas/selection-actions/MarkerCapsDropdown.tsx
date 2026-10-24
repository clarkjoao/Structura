import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { EdgeMarker } from "@/features/diagram";
import { cn } from "@/lib/utils";

const MARKER_OPTIONS: { value: EdgeMarker; labelKey: string }[] = [
  { value: "none" as EdgeMarker, labelKey: "markerNone" },
  { value: "arrow" as EdgeMarker, labelKey: "markerArrow" },
  { value: "arrow-closed" as EdgeMarker, labelKey: "markerArrowClosed" },
];

/**
 * The marker drawn as the end of a short line: the glyph says what the edge will look like, so the
 * toolbar needs no text. A start marker is the same glyph mirrored.
 */
function MarkerGlyph({ marker, capType }: { marker: EdgeMarker; capType: "start" | "end" }) {
  return (
    <svg
      width="26"
      height="12"
      viewBox="0 0 26 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-marker={marker}
      className={capType === "start" ? "-scale-x-100" : undefined}
    >
      <line x1="2" y1="6" x2={marker === EdgeMarker.None ? 24 : 22} y2="6" />
      {marker === EdgeMarker.Arrow && <polyline points="18,2 24,6 18,10" />}
      {marker === EdgeMarker.ArrowClosed && (
        <polygon points="17,2 24,6 17,10" fill="currentColor" />
      )}
    </svg>
  );
}

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
        className="flex items-center gap-0.5 h-6 px-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
        title={`${t(labelKey)}: ${t(`common.${selected.labelKey}`)}`}
        aria-label={`${t(labelKey)}: ${t(`common.${selected.labelKey}`)}`}
      >
        <MarkerGlyph marker={selected.value} capType={capType} />
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
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors",
                selected.value === opt.value
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <MarkerGlyph marker={opt.value} capType={capType} />
              {t(`common.${opt.labelKey}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
