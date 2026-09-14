import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, FileJson, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { ViewerCanvas } from "@/features/viewer";
import { layoutForVisualization } from "@/features/viewer/layoutForVisualization";
import { useStructuraFile } from "@/features/viewer/hooks/useStructuraFile";

/**
 * The reading route.
 *
 * A diagram, arranged by ELK's visualization profile, with nothing to press.
 * It is the surface a VSCode extension points a webview at: open the file,
 * see the architecture, and see it rearrange the moment the file changes.
 *
 * Nothing here writes. `layoutForVisualization` returns a copy, so opening a
 * link never rewrites the positions the user saved — which is the difference
 * between this and the auto-layout button, and the reason the two profiles
 * exist.
 */

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

function ViewLoading({ label }: { label: string }) {
  return (
    <div style={CENTERED}>
      <Loader2 size={20} className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function ViewError({ message }: { message: string }) {
  return (
    <div role="alert" style={{ ...CENTERED, color: "var(--color-text-danger)" }}>
      <AlertCircle size={24} />
      <span>{message}</span>
    </div>
  );
}

/**
 * The diagram the query names, arranged, or null while that is still running.
 *
 * The layout is async — ELK is a dynamic import and a big graph takes a
 * moment — so the arranged diagram arrives after the first render. Nothing
 * waits on a click: this runs on mount, and again whenever the source changes,
 * which is what makes a file save show up rearranged.
 */
function useVisualizationLayout(source: Diagram | null): {
  diagram: Diagram | null;
  failed: boolean;
} {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!source) {
      setDiagram(null);
      return;
    }
    let current = true;
    setFailed(false);
    void layoutForVisualization(source)
      .then((arranged) => {
        if (current) setDiagram(arranged);
      })
      .catch(() => {
        // A layout that throws must not leave a blank page: the diagram is
        // still readable at the positions it arrived with.
        if (current) {
          setDiagram(source);
          setFailed(true);
        }
      });
    return () => {
      current = false;
    };
  }, [source]);

  return { diagram, failed };
}

function FileSource({ path }: { path: string | null }) {
  const { t } = useTranslation();
  const { state, pick, supported } = useStructuraFile();
  const { diagram } = useVisualizationLayout(state.status === "ready" ? state.diagram : null);

  if (!supported) return <ViewError message={t("viewPage.errors.noFilePicker")} />;
  if (state.status === "error") return <ViewError message={t("viewPage.errors.invalidFile")} />;

  if (state.status === "idle") {
    return (
      <div style={CENTERED}>
        <FileJson size={32} style={{ opacity: 0.3 }} />
        <span>{path ?? t("viewPage.file.noPath")}</span>
        <button
          type="button"
          onClick={() => void pick()}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-foreground hover:bg-surface-hover"
        >
          {t("viewPage.file.open")}
        </button>
      </div>
    );
  }

  if (!diagram) return <ViewLoading label={t("viewPage.arranging")} />;
  return <ViewerCanvas diagram={diagram} showOpenInStructuraButton={false} />;
}

function StoreSource({ diagramId }: { diagramId: string }) {
  const { t } = useTranslation();
  const stored = useDiagramStore((state) => state.diagrams[diagramId]);
  const { diagram } = useVisualizationLayout(stored ?? null);

  if (!stored) return <ViewError message={t("viewPage.errors.notFound", { id: diagramId })} />;
  if (!diagram) return <ViewLoading label={t("viewPage.arranging")} />;
  return <ViewerCanvas diagram={diagram} showOpenInStructuraButton={false} />;
}

export function ViewPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();

  if (params.get("source") === "file") return <FileSource path={params.get("path")} />;

  const diagramId = params.get("diagramId");
  if (diagramId) return <StoreSource diagramId={diagramId} />;

  return <ViewError message={t("viewPage.errors.noSource")} />;
}

export default ViewPage;
