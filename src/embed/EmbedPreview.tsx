import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram/model/diagram.types";
import { ViewerCanvas } from "@/features/viewer/components/ViewerCanvas";
import { buildPreviewDiagram, changedComponentIds } from "./build-diagram";
import type { PreviewGraph } from "./protocol";
import {
  BLOCKED,
  LOAD_GRAPH,
  PROBE,
  PROBE_RESULT,
  READY,
  RENDERED,
  SEARCH,
  postToHost,
  readEmbedMessage,
} from "./protocol";

/**
 * The read-only preview: waits for a graph from its host and draws it with the viewer.
 * Every graph replaces the picture; the canvas stays mounted, so the reader's pan and zoom
 * survive updates — except that what an update changed is brought into view. Ctrl/Cmd+F
 * searches the diagram's elements.
 */
export function EmbedPreview() {
  const { t } = useTranslation();
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [focus, setFocus] = useState<{ ids: string[]; token: number } | null>(null);
  const lastGraph = useRef<PreviewGraph | null>(null);
  const [searchRequest, setSearchRequest] = useState(0);
  /** Why the picture is not (or no longer) following the YAML; null while it is. */
  const [blocked, setBlocked] = useState<{
    reason: "parse" | "errors";
    errors: number;
    problems: string[];
  } | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = readEmbedMessage(event.data);
      if (!message) return;
      if (message.type === LOAD_GRAPH) {
        const changed = changedComponentIds(lastGraph.current, message.graph);
        lastGraph.current = message.graph;
        setDiagram(buildPreviewDiagram(message.graph));
        setBlocked(null);
        if (changed.length > 0) setFocus((f) => ({ ids: changed, token: (f?.token ?? 0) + 1 }));
      } else if (message.type === SEARCH) setSearchRequest((n) => n + 1);
      else if (message.type === BLOCKED) {
        setBlocked({ reason: message.reason, errors: message.errors, problems: message.problems });
      } else if (message.type === PROBE) {
        // What a host's test cannot see inside the frame: where the canvas looks, and whether
        // the search is open.
        postToHost({
          type: PROBE_RESULT,
          viewport:
            document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "",
          searchOpen: document.querySelector(".viewer-canvas input") !== null,
          visible: document.visibilityState === "visible",
          blocked: document.querySelector('[role="status"]') !== null,
        });
      } else document.documentElement.classList.toggle("dark", message.theme === "dark");
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
    if (blocked) {
      return (
        <div className="flex h-screen items-center justify-center p-6">
          <div className="max-w-xl space-y-3 text-sm">
            <p className="font-medium text-destructive">
              {blocked.reason === "parse"
                ? t("embedPage.blockedParse")
                : t("embedPage.blockedTitle", { count: blocked.errors })}
            </p>
            {blocked.problems.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-muted-foreground">
                {blocked.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground">{t("embedPage.blockedHint")}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {t("embedPage.waiting")}
      </div>
    );
  }
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {blocked && (
        <div
          role="status"
          className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-destructive/40 bg-card px-3 py-1.5 text-xs text-destructive shadow"
        >
          {blocked.reason === "parse"
            ? t("embedPage.blockedStaleParse")
            : t("embedPage.blockedStale", { count: blocked.errors })}
        </div>
      )}
      <ViewerCanvas
        diagram={diagram}
        showOpenInStructuraButton={false}
        searchable
        searchRequest={searchRequest}
        focus={focus}
      />
    </div>
  );
}
