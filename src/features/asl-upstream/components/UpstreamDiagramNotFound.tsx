import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface UpstreamDiagramNotFoundProps {
  diagramName: string;
  onRetry?: () => void;
}

export function UpstreamDiagramNotFound({
  diagramName,
  onRetry,
}: UpstreamDiagramNotFoundProps) {
  const { t } = useTranslation();

  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("upstream.diagramNotFound", { name: diagramName })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("upstream.diagramNotFoundDesc")}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {t("common.retry")}
          </Button>
        )}
      </div>
    </div>
  );
}
