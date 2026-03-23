import { useEffect, useState } from "react";
import { AlertCircle, LayoutDashboard, Loader2 } from "lucide-react";
import type { Diagram } from "@/features/diagram";
import { decodeDiagramPayload } from "@/lib/embed-url";
import { EmbedCanvas } from "./embed/EmbedCanvas";


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


function parseDiagramFromJson(encoded: string): Diagram {
  const parsed = JSON.parse(decodeURIComponent(encoded));
  assertDiagram(parsed);
  return parsed;
}

function parseDiagramFromSrcString(src: string): Diagram {
  const parsed = JSON.parse(src);
  assertDiagram(parsed);
  return parsed;
}

const EmbedLoading = () => (
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
    Carregando diagrama...
  </div>
);

const EmbedWaiting = () => (
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
    <span>Aguardando diagrama...</span>
  </div>
);

const EmbedError = ({ message }: { message: string }) => (
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

type EmbedState =
  | { status: "loading" }
  | { status: "waiting" }
  | { status: "ready"; diagram: Diagram }
  | { status: "error"; message: string };

const EmbedPage = () => {
  const [state, setState] = useState<EmbedState>({ status: "loading" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const dataParam = params.get("data");
    if (dataParam) {
      try {
        setState({ status: "ready", diagram: decodeDiagramPayload(dataParam) });
      } catch {
        setState({ status: "error", message: "Invalid base64 diagram data" });
      }
      return;
    }

    const jsonParam = params.get("json");
    if (jsonParam) {
      try {
        setState({ status: "ready", diagram: parseDiagramFromJson(jsonParam) });
      } catch (err) {
        setState({
          status: "error",
          message: `Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`,
        });
      }
      return;
    }

    const srcParam = params.get("src");
    if (srcParam) {
      const trimmed = srcParam.trim();

      if (trimmed.startsWith("{")) {
        try {
          setState({ status: "ready", diagram: parseDiagramFromSrcString(trimmed) });
        } catch {
          setState({ status: "error", message: "Invalid JSON in ?src parameter" });
        }
        return;
      }

      void fetch(srcParam)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json: unknown) => {
          assertDiagram(json);
          setState({ status: "ready", diagram: json });
        })
        .catch((err: Error) => {
          setState({ status: "error", message: `Failed to load diagram: ${err.message}` });
        });
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
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid diagram";
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
  }, []);

  switch (state.status) {
    case "loading":
      return <EmbedLoading />;
    case "waiting":
      return <EmbedWaiting />;
    case "error":
      return <EmbedError message={state.message} />;
    case "ready":
      return <EmbedCanvas diagram={state.diagram} />;
  }
};

export default EmbedPage;
