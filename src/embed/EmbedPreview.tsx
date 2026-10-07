import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram/model/diagram.types";
import { ViewerCanvas } from "@/features/viewer/components/ViewerCanvas";
import { buildPreviewDiagram } from "./build-diagram";
import { LOAD_GRAPH, READY, RENDERED, postToHost, readEmbedMessage } from "./protocol";

/**
 * The read-only preview: waits for a graph from its host and draws it with the viewer.
 * Every graph replaces the picture; the canvas stays mounted, so the reader's pan and zoom
 * survive updates.
 */
export function EmbedPreview() {
  const { t } = useTranslation();
  const [diagram, setDiagram] = useState<Diagram | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = readEmbedMessage(event.data);
      if (!message) return;
      if (message.type === LOAD_GRAPH) setDiagram(buildPreviewDiagram(message.graph));
      else document.documentElement.classList.toggle("dark", message.theme === "dark");
    };
    window.addEventListener("message", onMessage);
    postToHost({ type: READY });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Tells the host what reached the screen — hosts and their tests cannot see inside the frame.
  useEffect(() => {
    if (!diagram) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() =>
        postToHost({
          type: RENDERED,
          nodes: document.querySelectorAll(".react-flow__node").length,
        }),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [diagram]);

  if (!diagram) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {t("embedPage.waiting")}
      </div>
    );
  }
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ViewerCanvas diagram={diagram} showOpenInStructuraButton={false} />
    </div>
  );
}
