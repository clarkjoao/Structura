import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Walkthrough } from "@/features/walkthroughs";
import { useWalkthroughsByDiagramId } from "@/features/walkthroughs";

export interface JourneysInDiagramPanelProps {
  diagramId: string;
  onClose: () => void;
}

function countStepsInDiagram(walkthrough: Walkthrough, diagramId: string): number {
  return Object.values(walkthrough.steps).filter((step) => step.diagramId === diagramId).length;
}

export function WalkthroughsInDiagramPanel({ diagramId, onClose }: JourneysInDiagramPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const walkthroughs = useWalkthroughsByDiagramId(diagramId);

  return (
    <div className="absolute left-4 top-[200px] z-20 flex max-h-[min(70vh,calc(100%-14rem))] w-[min(100%,280px)] flex-col rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-sm">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {t("walkthroughs.inDiagram.title")}
        </h2>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {walkthroughs.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {walkthroughs.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t("walkthroughs.inDiagram.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {walkthroughs.map((walkthrough) => {
              const stepsHere = countStepsInDiagram(walkthrough, diagramId);
              return (
                <li
                  key={walkthrough.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {walkthrough.name}
                    </div>
                    <div className="mt-0.5">
                      <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t("walkthroughs.inDiagram.stepsHere", { count: stepsHere })}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={t("walkthroughs.inDiagram.openEditor")}
                    onClick={() => {
                      void navigate(`/walkthroughs/${walkthrough.id}/edit`);
                    }}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
