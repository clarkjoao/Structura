import { useMemo } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { JourneyStep } from "../../types";
import { getSafeJourneyVisual } from "../../utils/step-media.utils";

interface VisualStateOverlayProps {
  step: JourneyStep;
  onClose: () => void;
}

export function VisualStateOverlay({ step, onClose }: VisualStateOverlayProps) {
  const { t } = useTranslation();
  const visual = useMemo(() => getSafeJourneyVisual(step), [step]);
  if (!visual) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("journeys.editor.visualOverlayLabel")}
    >
      <div
        className="relative max-h-[82%] max-w-[72%] cursor-default overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-2 top-2 z-10 rounded-lg border border-border bg-card/90 p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onClose}
          aria-label={t("journeys.editor.closeVisual")}
        >
          <X className="h-4 w-4" />
        </button>

        {visual.kind === "svg" ? (
          <div
            className="p-6 [&_svg]:h-auto [&_svg]:max-h-[75vh] [&_svg]:w-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: visual.html }}
          />
        ) : (
          <img
            src={visual.src}
            alt=""
            className="block max-h-[75vh] w-auto max-w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}
