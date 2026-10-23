import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  LAYOUT_DENSITIES,
  LAYOUT_GAP_MAX,
  LAYOUT_GAP_MIN,
  type DiagramLayoutSettings,
  type LayoutDensity,
} from "@/features/diagram/model/layout-settings";
import { effectiveLayoutGaps } from "../layout/layoutEngine";
import { Kbd } from "./Kbd";
import { arrangeShortcutLabel } from "./shortcutLabels";

export interface ArrangeControlProps {
  /** The diagram's stored layout settings. */
  settings: DiagramLayoutSettings | undefined;
  /** Whether the diagram has edge labels, which picks the tuned between-layer gap. */
  labelled: boolean;
  /** An arrangement is being computed. */
  running: boolean;
  /** Arranges with the diagram's stored settings. */
  onArrange: () => void;
  /** Arranges with `settings` and stores them, as one undo step. */
  onSettingsChange: (settings: DiagramLayoutSettings) => void;
  /** Stores `settings` without arranging, as one undo step — switching the mode. */
  onSettingsSave: (settings: DiagramLayoutSettings) => void;
  onOpenChange?: (open: boolean) => void;
  buttonClassName: string;
}

const DENSITY_LABEL_KEY: Record<LayoutDensity, string> = {
  compact: "canvasToolbar.arrange.densityCompact",
  normal: "canvasToolbar.arrange.densityNormal",
  spacious: "canvasToolbar.arrange.densitySpacious",
};

/** How long a slider rests before it re-arranges: one run per gesture, not per tick. */
export const ARRANGE_SLIDER_DEBOUNCE_MS = 250;

const SECTION_TITLE_CLASS =
  "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * The bottom toolbar's Arrange split button: the main half arranges the
 * diagram, the chevron opens how it is arranged.
 *
 * A change in the menu re-arranges at once — the setting is only written by the
 * run it shaped, so it and the arrangement are one undo step. While a run is in
 * flight the latest request waits and runs next (the last click wins); the menu
 * shows that request meanwhile, so the choice does not seem to bounce back.
 */
export function ArrangeControl({
  settings,
  labelled,
  running,
  onArrange,
  onSettingsChange,
  onSettingsSave,
  onOpenChange,
  buttonClassName,
}: ArrangeControlProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<DiagramLayoutSettings | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(
    () => settings?.layerGap !== undefined || settings?.nodeGap !== undefined,
  );
  const queued = useRef<DiagramLayoutSettings | null>(null);
  const sliderTimer = useRef<ReturnType<typeof setTimeout>>();

  const shown = pending ?? settings ?? {};
  const density = shown.density ?? "normal";
  const automatic = shown.mode === "automatic";
  const gaps = effectiveLayoutGaps(shown, labelled);
  const [draftGaps, setDraftGaps] = useState<{ layerGap?: number; nodeGap?: number }>({});

  const request = (next: DiagramLayoutSettings) => {
    setPending(next);
    if (running) queued.current = next;
    else onSettingsChange(next);
  };

  // A run finished: send what waited, or let the stored settings show again.
  useEffect(() => {
    if (running) return;
    const next = queued.current;
    if (next) {
      queued.current = null;
      onSettingsChange(next);
    } else {
      setPending(null);
    }
  }, [running, onSettingsChange]);

  useEffect(() => () => clearTimeout(sliderTimer.current), []);

  const changeGap = (key: "layerGap" | "nodeGap", value: number) => {
    setDraftGaps((current) => ({ ...current, [key]: value }));
    clearTimeout(sliderTimer.current);
    sliderTimer.current = setTimeout(() => {
      setDraftGaps({});
      request({ ...shown, [key]: value });
    }, ARRANGE_SLIDER_DEBOUNCE_MS);
  };

  const hasGapOverride = shown.layerGap !== undefined || shown.nodeGap !== undefined;
  const isDefault = density === "normal" && !hasGapOverride && !automatic;

  /**
   * Switching the mode moves nothing in either direction: automatic places what
   * the author adds from now on, it does not re-shuffle what is already there.
   */
  const changeMode = (mode: "manual" | "automatic") => {
    queued.current = null;
    setPending(null);
    onSettingsSave({ ...shown, mode });
  };

  /** Back to the layout the editor always ran: manual, normal spacing, no gap overrides. */
  const resetToDefaults = () => {
    clearTimeout(sliderTimer.current);
    setDraftGaps({});
    request({});
  };
  const shortcut = arrangeShortcutLabel();
  const arrangeTitle = t("canvasToolbar.arrange.withShortcut", { shortcut });

  const renderSlider = (key: "layerGap" | "nodeGap", labelKey: string) => {
    const value = draftGaps[key] ?? gaps[key];
    const id = `arrange-${key}`;
    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={id}
          className="flex items-center justify-between text-xs font-medium text-foreground"
        >
          {t(labelKey)}
          <span className="font-mono text-[11px] text-muted-foreground">{value}px</span>
        </label>
        <input
          id={id}
          type="range"
          min={LAYOUT_GAP_MIN}
          max={LAYOUT_GAP_MAX}
          step={10}
          value={value}
          onChange={(event) => changeGap(key, Number(event.target.value))}
          className="h-1.5 w-full cursor-pointer accent-primary"
        />
      </div>
    );
  };

  return (
    <div className="flex items-center">
      <button
        type="button"
        title={arrangeTitle}
        aria-label={arrangeTitle}
        aria-keyshortcuts="Meta+Shift+L Control+Shift+L"
        aria-busy={running}
        disabled={running}
        onClick={onArrange}
        className={cn(buttonClassName, "rounded-r-none text-foreground")}
      >
        {running ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Wand2 aria-hidden className="h-4 w-4" />
        )}
        {t("canvasToolbar.arrange.label")}
        {automatic && (
          <span className="rounded bg-primary/15 px-1 text-[10px] font-medium text-primary">
            {t("canvasToolbar.arrange.autoBadge")}
          </span>
        )}
      </button>
      <Popover onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={t("canvasToolbar.arrange.optionsAria")}
            aria-label={t("canvasToolbar.arrange.optionsAria")}
            className={cn(buttonClassName, "rounded-l-none px-1")}
          >
            <ChevronDown aria-hidden className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={10}
          aria-label={t("canvasToolbar.arrange.title")}
          className="w-72 p-3"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {t("canvasToolbar.arrange.title")}
            </p>
            {running ? (
              <span className="text-[11px] text-muted-foreground" role="status">
                {t("canvasToolbar.arrange.running")}
              </span>
            ) : (
              <Kbd>{shortcut}</Kbd>
            )}
          </div>

          <p className={SECTION_TITLE_CLASS}>{t("canvasToolbar.arrange.mode")}</p>
          <div
            role="radiogroup"
            aria-label={t("canvasToolbar.arrange.mode")}
            className="mb-3 grid grid-cols-2 gap-1"
          >
            {(["manual", "automatic"] as const).map((mode) => {
              const checked = (mode === "automatic") === automatic;
              const labelKey =
                mode === "automatic"
                  ? "canvasToolbar.arrange.modeAutomatic"
                  : "canvasToolbar.arrange.modeManual";
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    if (!checked) changeMode(mode);
                  }}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                    checked
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
          <p className="-mt-2 mb-3 text-[11px] text-muted-foreground">
            {t(
              automatic
                ? "canvasToolbar.arrange.modeAutomaticHint"
                : "canvasToolbar.arrange.modeManualHint",
            )}
          </p>

          <p className={SECTION_TITLE_CLASS}>{t("canvasToolbar.arrange.density")}</p>
          <div
            role="radiogroup"
            aria-label={t("canvasToolbar.arrange.density")}
            className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
          >
            {LAYOUT_DENSITIES.map((option) => {
              const checked = density === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    if (!checked) request({ ...shown, density: option });
                  }}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    checked
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(DENSITY_LABEL_KEY[option])}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t("canvasToolbar.arrange.densityHint")}
          </p>

          <div className="mt-3 border-t border-border pt-2">
            <button
              type="button"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((open) => !open)}
              className="flex w-full items-center justify-between text-xs font-medium text-foreground"
            >
              {t("canvasToolbar.arrange.advanced")}
              <ChevronDown
                aria-hidden
                className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-180")}
              />
            </button>
            {showAdvanced && (
              <div className="mt-2 flex flex-col gap-3">
                {renderSlider("layerGap", "canvasToolbar.arrange.layerGap")}
                {renderSlider("nodeGap", "canvasToolbar.arrange.nodeGap")}
                <button
                  type="button"
                  disabled={!hasGapOverride}
                  onClick={() => request(shown.density ? { density: shown.density } : {})}
                  className="self-start text-[11px] text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
                >
                  {t("canvasToolbar.arrange.resetGaps")}
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end border-t border-border pt-2">
            <button
              type="button"
              disabled={isDefault}
              onClick={resetToDefaults}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              {t("canvasToolbar.arrange.resetDefaults")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
