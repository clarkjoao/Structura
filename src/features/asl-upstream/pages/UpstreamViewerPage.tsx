import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw, Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewerCanvas } from "@/features/viewer";
import { UpstreamDiagramNotFound } from "../components/UpstreamDiagramNotFound";
import { fetchDiagramUrls, fetchDiagramJson } from "../api/upstreamApi";
import type { Diagram } from "@/features/diagram";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; diagram: Diagram }
  | { status: "error"; message: string };

const CENTERED: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 10,
  height: "100vh",
  fontSize: 13,
  color: "var(--color-text-tertiary)",
};

function ViewerFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

export default function UpstreamViewerPage() {
  const { t } = useTranslation();
  const { namespace } = useParams<{ namespace: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadDiagram = useCallback(async () => {
    if (!namespace) return;

    setState({ status: "loading" });

    try {
      const urls = await fetchDiagramUrls(namespace);

      // Get the first file URL
      const fileName = Object.keys(urls)[0];
      if (!fileName) {
        setState({ status: "error", message: t("upstream.noDiagrams") });
        return;
      }

      const signedUrl = urls[fileName];
      const diagramData = await fetchDiagramJson(signedUrl);

      // Validate diagram structure
      if (
        !diagramData ||
        typeof diagramData !== "object" ||
        !("id" in diagramData) ||
        !("snapshot" in diagramData)
      ) {
        setState({ status: "error", message: t("upstream.invalidDiagram") });
        return;
      }

      setState({ status: "ready", diagram: diagramData as Diagram });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : t("upstream.loadFailed"),
      });
    }
  }, [namespace, t]);

  useEffect(() => {
    void loadDiagram();
  }, [loadDiagram]);

  const handleBack = useCallback(() => {
    navigate("/upstream");
  }, [navigate]);

  const handleRetry = useCallback(() => {
    void loadDiagram();
  }, [loadDiagram]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Server className="h-4 w-4 shrink-0 text-primary" />
          <h1 className="truncate text-sm font-medium">{namespace}</h1>
          <span className="shrink-0 text-xs text-muted-foreground">{t("upstream.viewer")}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-xs"
          onClick={handleRetry}
        >
          <RefreshCw className="h-3 w-3" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0">
        {state.status === "loading" && (
          <div style={CENTERED}>
            <Loader2 size={20} className="animate-spin" />
            <span>{t("upstream.loading")}</span>
          </div>
        )}

        {state.status === "error" && (
          <UpstreamDiagramNotFound diagramName={namespace ?? ""} onRetry={handleRetry} />
        )}

        {state.status === "ready" && (
          <ViewerFrame>
            <ViewerCanvas diagram={state.diagram} showOpenInStructuraButton={false} />
          </ViewerFrame>
        )}
      </div>
    </div>
  );
}
