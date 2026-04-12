import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface JourneyCompletedOverlayProps {
  journeyName: string;
  onRestart: () => void;
  onExit: () => void;
}

export function JourneyCompletedOverlay({
  journeyName,
  onRestart,
  onExit,
}: JourneyCompletedOverlayProps) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex max-w-md flex-col items-center gap-6 rounded-2xl border border-border bg-card p-10 shadow-2xl">
        <CheckCircle2 className="h-14 w-14 text-primary" aria-hidden />
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{journeyName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("journeys.presentation.completed")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" variant="outline" onClick={onRestart}>
            {t("journeys.presentation.restart")}
          </Button>
          <Button type="button" variant="secondary" onClick={onExit}>
            {t("journeys.presentation.exitPresentation")}
          </Button>
        </div>
      </div>
    </div>
  );
}
