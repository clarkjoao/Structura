import type { ChangeEventHandler, ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Play,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sanitizeSvg } from "@/features/canvas";
import { useJourneyActions } from "../../store/selectors/journeys.selectors";
import type { JourneyStep } from "../../types";

interface RightPanelProps {
  journeyId: string;
  step: JourneyStep | null;
  
  flowSection: ReactNode;
}

export function RightPanel({
  journeyId,
  step,
  flowSection,
}: RightPanelProps) {
  const { t } = useTranslation();
  const { updateJourneyStep } = useJourneyActions();

  const [visualOpen, setVisualOpen] = useState(true);
  const [flowOpen, setFlowOpen] = useState(true);
  const panelCollapsed = !visualOpen && !flowOpen;

  const handleUpload: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !step) return;
    void file.text().then((text) => {
      const cleaned = sanitizeSvg(text);
      if (!cleaned) {
        toast.error(t("icons.invalidSvg"));
        return;
      }
      updateJourneyStep(journeyId, step.id, { svgContent: cleaned });
    });
  };

  const handleRemoveSvg = () => {
    if (!step) return;
    updateJourneyStep(journeyId, step.id, { svgContent: undefined });
  };

  if (panelCollapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-l border-border bg-card py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={t("journeys.editor.expandVisualPanel")}
          onClick={() => setVisualOpen(true)}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={t("journeys.editor.expandFlowPanel")}
          onClick={() => setFlowOpen(true)}
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
            <span className="text-sm font-semibold text-foreground">
              {t("journeys.editor.visualStateTitle")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={
                visualOpen
                  ? t("journeys.editor.collapseVisualPanel")
                  : t("journeys.editor.expandVisualPanel")
              }
              onClick={() => setVisualOpen((previous) => !previous)}
            >
              {visualOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          {visualOpen ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {!step ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t("journeys.editor.selectStepForVisual")}
                </p>
              ) : step.svgContent ? (
                <div className="grid gap-3">
                  <div
                    className="w-full [&_svg]:h-auto [&_svg]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: step.svgContent }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1"
                    onClick={handleRemoveSvg}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("journeys.editor.removeSvg")}
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t("journeys.editor.uploadSvg")}
                  </span>
                  <input
                    type="file"
                    accept=".svg"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-t border-border">
          <div
            className={`flex h-11 shrink-0 items-center justify-between px-3 ${flowOpen ? "border-b border-border" : ""}`}
          >
            <span className="text-sm font-semibold text-foreground">
              {t("journeys.editor.flowSectionTitle")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={
                flowOpen
                  ? t("journeys.editor.collapseFlowPanel")
                  : t("journeys.editor.expandFlowPanel")
              }
              onClick={() => setFlowOpen((previous) => !previous)}
            >
              {flowOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          {flowOpen ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {flowSection}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
