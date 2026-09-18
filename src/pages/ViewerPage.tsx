import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, FileJson, LayoutDashboard, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { ViewerCanvas } from "@/features/viewer";
import { useStructuraFile } from "@/features/viewer/hooks/useStructuraFile";
import { getFlowParamFromUrl, getViewerDataFromHash } from "@/lib/share-url";

/**
 * The reading route — every way into it.
 *
 * There used to be two: `/viewer` for a diagram handed over whole (a share
 * link's `#data=` payload, or an embedding page's `postMessage`), and `/view`
 * for one named by id or read off disk with ELK arranging it. Two names a
 * letter apart for the same job. This is the one route, and it kept the name
 * that is already out in the world: `generateViewerUrl` writes `/viewer#data=`
 * into every shared link, and `EmbedModal` writes `/viewer` into every iframe
 * snippet it hands out.
 *
 * **No source is re-arranged.** Every way in renders the positions and edge
 * waypoints the diagram carries — the same picture the editor draws. The
 * `?diagramId` and file sources used to run ELK on load, which replaced the
 * author's layout with a different one
 * (docs/investigation/divergencia-edicao-visualizacao.md §3.5). A diagram that
 * should read arranged is arranged in the editor, with auto layout, and saved.
 *
 * Nothing here writes: the route only reads the store and the file.
 *
 * `#share=` is not handled here at all: `useSharedDiagram` reads it in `App`,
 * above the router, so it works on any path.
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

function ViewerLoading({ label }: { label: string }) {
  return (
    <div style={CENTERED}>
      <Loader2 size={20} className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function ViewerWaiting() {
  const { t } = useTranslation();
  return (
    <div style={CENTERED}>
      <LayoutDashboard size={32} style={{ opacity: 0.3 }} />
      <span>{t("embedPage.waiting")}</span>
    </div>
  );
}

function ViewerError({ message }: { message: string }) {
  return (
    <div role="alert" style={{ ...CENTERED, color: "var(--color-text-danger)" }}>
      <AlertCircle size={24} />
      <span>{message}</span>
    </div>
  );
}

function assertDiagram(value: unknown): asserts value is Diagram {
  if (!value || typeof value !== "object" || !("id" in value) || !("snapshot" in value)) {
    throw new Error("Missing required fields: id, snapshot");
  }
}

/** Named, and actually in the diagram that arrived. */
function namedFlowIn(diagram: Diagram, flowId: string | null): string | null {
  return flowId && diagram.snapshot.flows?.[flowId] ? flowId : null;
}

/** `?source=file&path=` — a `.structura.json` the reader picks, watched for changes. */
function FileSource({ path }: { path: string | null }) {
  const { t } = useTranslation();
  const { state, pick, supported } = useStructuraFile();

  if (!supported) return <ViewerError message={t("viewPage.errors.noFilePicker")} />;
  if (state.status === "error") return <ViewerError message={t("viewPage.errors.invalidFile")} />;

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

  if (state.status === "reading") return <ViewerLoading label={t("embedPage.loading")} />;
  return <ViewerCanvas diagram={state.diagram} showOpenInStructuraButton={false} />;
}

/** `?diagramId=` — one of the reader's own diagrams, at its saved positions. */
function StoreSource({ diagramId }: { diagramId: string }) {
  const { t } = useTranslation();
  const stored = useDiagramStore((state) => state.diagrams[diagramId]);

  if (!stored) return <ViewerError message={t("viewPage.errors.notFound", { id: diagramId })} />;
  return <ViewerCanvas diagram={stored} showOpenInStructuraButton={false} />;
}

type HandedOverState =
  | { status: "loading" }
  | { status: "waiting" }
  | { status: "ready"; diagram: Diagram; flowId: string | null }
  | { status: "error"; message: string };

/**
 * A diagram handed over whole: a share link's `#data=` payload, or an embedding
 * page answering `STRUCTURA_READY` with `STRUCTURA_LOAD`.
 *
 * No layout runs here. The payload carries the positions its author arranged,
 * and that arrangement is the thing being shared.
 */
function HandedOverDiagram() {
  const { t } = useTranslation();
  const [state, setState] = useState<HandedOverState>({ status: "loading" });

  useEffect(() => {
    const diagram = getViewerDataFromHash();
    if (diagram) {
      setState({ status: "ready", diagram, flowId: namedFlowIn(diagram, getFlowParamFromUrl()) });
      return;
    }

    setState({ status: "waiting" });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "STRUCTURA_LOAD") return;

      const json = event.data.diagram;
      const replyOrigin = event.origin && event.origin !== "null" ? event.origin : "*";

      try {
        assertDiagram(json);
        setState({
          status: "ready",
          diagram: json,
          flowId: namedFlowIn(json, getFlowParamFromUrl()),
        });
        event.source?.postMessage(
          { type: "STRUCTURA_LOADED", success: true },
          { targetOrigin: replyOrigin },
        );
      } catch {
        const message = t("embedPage.errors.invalidDiagram");
        setState({ status: "error", message });
        event.source?.postMessage(
          { type: "STRUCTURA_LOADED", success: false, error: message },
          { targetOrigin: replyOrigin },
        );
      }
    };

    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "STRUCTURA_READY" }, "*");

    return () => window.removeEventListener("message", handleMessage);
  }, [t]);

  switch (state.status) {
    case "loading":
      return <ViewerLoading label={t("embedPage.loading")} />;
    case "waiting":
      return <ViewerWaiting />;
    case "error":
      return <ViewerError message={state.message} />;
    case "ready":
      return <ViewerCanvas diagram={state.diagram} initialFlowId={state.flowId} />;
  }
}

export function ViewerPage() {
  const [params] = useSearchParams();

  if (params.get("source") === "file") return <FileSource path={params.get("path")} />;

  const diagramId = params.get("diagramId");
  if (diagramId) return <StoreSource diagramId={diagramId} />;

  return <HandedOverDiagram />;
}

export default ViewerPage;
