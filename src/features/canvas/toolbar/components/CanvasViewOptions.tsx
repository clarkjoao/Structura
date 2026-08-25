import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCanvasPreferencesStore, type CanvasScrollMode } from "../../preferences";

interface ScrollModeOption {
  value: CanvasScrollMode;
  labelKey: string;
  hintKey: string;
}

const SCROLL_MODE_OPTIONS: ScrollModeOption[] = [
  {
    value: "pan",
    labelKey: "canvasToolbar.scrollBehaviorPan",
    hintKey: "canvasToolbar.scrollBehaviorPanHint",
  },
  {
    value: "zoom",
    labelKey: "canvasToolbar.scrollBehaviorZoom",
    hintKey: "canvasToolbar.scrollBehaviorZoomHint",
  },
];

/**
 * Canvas-scoped view preferences. The application has no settings page, so the controls that
 * change how the canvas responds live on the canvas itself, next to `<Controls>`.
 */
export function CanvasViewOptions() {
  const { t } = useTranslation();
  const scrollMode = useCanvasPreferencesStore((state) => state.scrollMode);
  const setScrollMode = useCanvasPreferencesStore((state) => state.setScrollMode);
  const showMiniMap = useCanvasPreferencesStore((state) => state.showMiniMap);
  const setShowMiniMap = useCanvasPreferencesStore((state) => state.setShowMiniMap);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t("canvasToolbar.viewOptions")}
          aria-label={t("canvasToolbar.viewOptionsAria")}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("canvasToolbar.scrollBehavior")}
        </p>
        <div
          role="radiogroup"
          aria-label={t("canvasToolbar.scrollBehavior")}
          className="flex flex-col gap-1"
        >
          {SCROLL_MODE_OPTIONS.map((option) => {
            const checked = scrollMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setScrollMode(option.value)}
                className={cn(
                  "rounded-md border px-2.5 py-2 text-left transition-colors",
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent text-foreground hover:bg-surface-hover",
                )}
              >
                <span className="block text-xs font-medium">{t(option.labelKey)}</span>
                <span className="block text-[11px] text-muted-foreground">{t(option.hintKey)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
          {t("canvasToolbar.scrollBehaviorShortcut")}
        </p>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 border-t border-border pt-3 text-xs font-medium text-foreground">
          {t("canvasToolbar.showMiniMap")}
          <Switch checked={showMiniMap} onCheckedChange={setShowMiniMap} />
        </label>
      </PopoverContent>
    </Popover>
  );
}
