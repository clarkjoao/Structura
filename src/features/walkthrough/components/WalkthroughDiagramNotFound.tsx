import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  diagramId: string;
  /** When provided, shows a "skip this scene" button instead of hiding the "back to library" button. */
  onSkip?: () => void;
  skipLabel?: string;
}

export function WalkthroughDiagramNotFound({ diagramId, onSkip, skipLabel }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <div className="max-w-sm">
        <h2 className="text-lg font-semibold text-foreground">
          {t("walkthrough.diagramNotFoundTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "walkthrough.diagramNotFoundMessage",
            `The diagram "${diagramId}" no longer exists. It may have been deleted.`,
          )}
        </p>
      </div>
      <div className="flex gap-3">
        {onSkip ? (
          <Button variant="outline" onClick={onSkip}>
            {skipLabel ?? t("walkthrough.skipScene")}
          </Button>
        ) : null}
        <Button onClick={() => navigate("/workflows")}>{t("walkthrough.backToLibrary")}</Button>
      </div>
    </div>
  );
}
