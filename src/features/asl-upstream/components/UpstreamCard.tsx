import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FileJson, ExternalLink } from "lucide-react";
import type { UpstreamDiagram } from "../types";

interface UpstreamCardProps {
  diagram: UpstreamDiagram;
}

export function UpstreamCard({ diagram }: UpstreamCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleOpen = useCallback(() => {
    navigate(`/upstream/${diagram.namespace}/view`);
  }, [navigate, diagram.namespace]);

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-surface-hover"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/50">
          <FileJson className="h-5 w-5 text-primary" />
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div>
        <h3 className="truncate font-medium text-foreground">{diagram.namespace}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {diagram.files.length} {t("upstream.diagram", { count: diagram.files.length })}
        </p>
      </div>
    </button>
  );
}
