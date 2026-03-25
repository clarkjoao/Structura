import { useEffect, useState } from "react";
import { AlertCircle, LayoutDashboard, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import { getViewerDataFromHash } from "@/lib/diagram-url";
import { ViewerCanvas } from "./ViewerCanvas";

function assertDiagram(value: unknown): asserts value is Diagram {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("snapshot" in value)
  ) {
    throw new Error("Missing required fields: id, snapshot");
  }
}

function ViewerLoading() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "var(--color-text-tertiary)",
        fontSize: 13,
      }}
    >
      <Loader2 size={20} className="animate-spin" style={{ marginRight: 8 }} />
      {t("embedPage.loading")}
    </div>
  );
}

function ViewerWaiting() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "var(--color-text-tertiary)",
        fontSize: 13,
        flexDirection: "column",
        gap: 8,
      }}
    >
      <LayoutDashboard size={32} style={{ opacity: 0.3 }} />
      <span>{t("embedPage.waiting")}</span>
    </div>
  );
}

interface ViewerErrorProps {
  message: string;
}

function ViewerError({ message }: ViewerErrorProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "var(--color-text-danger)",
        fontSize: 13,
        flexDirection: "column",
        gap: 8,
      }}
    >
      <AlertCircle size={24} />
      <span>{message}</span>
    </div>
  );
}

type ViewerState =
  | { status: "loading" }
  | { status: "waiting" }
  | { status: "ready"; diagram: Diagram }
  | { status: "error"; message: string };

export function ViewerPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<ViewerState>({ status: "loading" });

  useEffect(() => {
    const diagram = getViewerDataFromHash();
    if (diagram) {
      setState({ status: "ready", diagram });
      return;
    }

    setState({ status: "waiting" });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "STRUCTURA_LOAD") return;

      const json = event.data.diagram;
      const replyOrigin =
        event.origin && event.origin !== "null" ? event.origin : "*";

      try {
        assertDiagram(json);
        setState({ status: "ready", diagram: json });
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
      return <ViewerLoading />;
    case "waiting":
      return <ViewerWaiting />;
    case "error":
      return <ViewerError message={state.message} />;
    case "ready":
      return <ViewerCanvas diagram={state.diagram} />;
  }
}
