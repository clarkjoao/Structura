import type { ChangeEventHandler } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Image as ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sanitizeSvg } from "@/features/canvas";
import { useJourneyActions } from "../../selectors";
import type { JourneyStep } from "../../types";

interface RightPanelProps {
  journeyId: string;
  step: JourneyStep | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function RightPanel({
  journeyId,
  step,
  collapsed,
  onToggleCollapse,
}: RightPanelProps) {
  const { t } = useTranslation();
  const { updateJourneyStep } = useJourneyActions();

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

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-l border-border bg-card py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={t("journeys.editor.expandVisualPanel")}
          onClick={onToggleCollapse}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-[280px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-semibold text-foreground">
          {t("journeys.editor.visualStateTitle")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("journeys.editor.collapseVisualPanel")}
          onClick={onToggleCollapse}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
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
    </div>
  );
}
