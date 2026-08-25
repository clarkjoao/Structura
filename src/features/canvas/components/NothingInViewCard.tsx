import { Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReactFlow } from "@xyflow/react";
import {
  FIT_VIEW_DURATION_MS,
  FIT_VIEW_INITIAL_PADDING,
  FIT_VIEW_MAX_ZOOM,
  VIEWPORT_MIN_ZOOM,
} from "../canvas.constants";

interface NothingInViewCardProps {
  /** How many elements exist in the diagram, all of them currently off screen. */
  elementCount: number;
}

/**
 * The canvas is infinite, so it is easy to pan past every element and end up staring at an
 * empty grid with nothing to steer by. This card appears exactly in that situation and offers
 * the way back.
 */
export function NothingInViewCard({ elementCount }: NothingInViewCardProps) {
  const { t } = useTranslation();
  const reactFlow = useReactFlow();

  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-30 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-sm">
        <Compass className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{t("canvas.nothingInView")}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("canvas.nothingInViewHint", { count: elementCount })}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            void reactFlow.fitView({
              padding: FIT_VIEW_INITIAL_PADDING,
              minZoom: VIEWPORT_MIN_ZOOM,
              maxZoom: FIT_VIEW_MAX_ZOOM,
              duration: FIT_VIEW_DURATION_MS,
            })
          }
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("canvas.fitAll")}
        </button>
      </div>
    </div>
  );
}
