import { useEffect, useState } from "react";
import { AlertCircle, LayoutDashboard, Loader2 } from "lucide-react";
import type { Diagram } from "@/features/diagram";
import { EmbedCanvas } from "./embed/EmbedCanvas";

interface EmbedErrorProps {
  message: string;
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

const EmbedError = ({ message }: EmbedErrorProps) => (
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

const EmbedPage = () => {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const dataParam = params.get("data");
    if (dataParam) {
      try {
        const json = JSON.parse(atob(dataParam));
        if (!json || typeof json !== "object") throw new Error("Invalid diagram");
        setDiagram(json as Diagram);
        setLoading(false);
        return;
      } catch {
        setError("Invalid base64 diagram data");
        setLoading(false);
        return;
      }
    }

    const srcParam = params.get("src");
    if (srcParam) {
      void fetch(srcParam)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((json: unknown) => {
          if (!json || typeof json !== "object") throw new Error("Invalid diagram");
          setDiagram(json as Diagram);
          setLoading(false);
        })
        .catch((fetchError: Error) => {
          setError(`Failed to load diagram: ${fetchError.message}`);
          setLoading(false);
        });
      return;
    }

    setLoading(false);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "STRUCTURA_LOAD") return;

      const json = event.data.diagram;
      const replyOrigin =
        event.origin && event.origin !== "null" ? event.origin : "*";

      if (
        !json ||
        typeof json !== "object" ||
        !("id" in json) ||
        !("snapshot" in json)
      ) {
        setError("Invalid diagram data received");
        event.source?.postMessage(
          {
            type: "STRUCTURA_LOADED",
            success: false,
            error: "Missing id or snapshot",
          },
          { targetOrigin: replyOrigin },
        );
        return;
      }

      setDiagram(json as Diagram);
      setError(null);
      event.source?.postMessage(
        { type: "STRUCTURA_LOADED", success: true },
        { targetOrigin: replyOrigin },
      );
    };

    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "STRUCTURA_READY" }, "*");

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (error) return <EmbedError message={error} />;
  if (!diagram && loading) return <EmbedLoading />;
  if (!diagram) return <EmbedWaiting />;
  return <EmbedCanvas diagram={diagram} />;
};

export default EmbedPage;
