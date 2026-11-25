import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isSharedRefComponent } from "@/features/diagram/model/component.guards";
import type { Diagram } from "@/features/diagram/model/diagram.types";
import { ViewerCanvas, type ViewerElementRef } from "@/features/viewer/components/ViewerCanvas";
import { arrangePreviewDiagram, arrangeSignature, withContentOf } from "./arrange";
import { buildPreviewDiagram, changedComponentIds } from "./build-diagram";
import type { PreviewArrange, PreviewGraph } from "./protocol";
import {
  ARRANGE,
  BLOCKED,
  LOAD_GRAPH,
  OPEN_PROBLEM,
  PROBE,
  PROBE_RESULT,
  READY,
  RENDERED,
  OPEN,
  REVEAL,
  SEARCH,
  SELECT,
  postToHost,
  readEmbedMessage,
} from "./protocol";

/**
 * The read-only preview: waits for a graph from its host and draws it with the viewer.
 * Every graph replaces the picture; the canvas stays mounted, so the reader's pan and zoom
 * survive updates — except that what an update changed is brought into view. Ctrl/Cmd+F
 * searches the diagram's elements. A click on an element tells the host (`STRUCTURA_REVEAL`),
 * and the host can light one (`STRUCTURA_SELECT`) — together, the way between picture and source.
 *
 * Who places the picture is the host's `arrange`: its own positions (`manual`, the default), or
 * the canvas arranger here (`automatic`), so the preview reads the way the diagram reads on the
 * canvas, references included. Like the canvas, an automatic picture is re-arranged only when
 * its structure changes: a text edit keeps every element where it was.
 */
export function EmbedPreview() {
  const { t } = useTranslation();
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [focus, setFocus] = useState<{ ids: string[]; token: number } | null>(null);
  const lastGraph = useRef<PreviewGraph | null>(null);
  /** The diagram on screen, for the callbacks: a click on a reference names its original. */
  const shown = useRef<Diagram | null>(null);
  shown.current = diagram;
  /** Whether the picture on screen was arranged here (for the host's tests). */
  const arrangedHere = useRef(false);
  const [searchRequest, setSearchRequest] = useState(0);
  const [select, setSelect] = useState<{
    element: ViewerElementRef | null;
    token: number;
  } | null>(null);
  /** Why the picture is not (or no longer) following the YAML; null while it is. */
  const [blocked, setBlocked] = useState<{
    reason: "parse" | "errors";
    errors: number;
    problems: string[];
  } | null>(null);

  useEffect(() => {
    let arrange: PreviewArrange = { mode: "manual" };
    /** The last automatic arrangement, kept while the structure it was made for lasts. */
    let arranged: { signature: string; diagram: Diagram } | null = null;
    /** Monotonic: an arrangement that finishes after a newer graph arrived is dropped. */
    let run = 0;

    const show = (graph: PreviewGraph) => {
      const fresh = buildPreviewDiagram(graph);
      const current = ++run;
      if (arrange.mode !== "automatic") {
        arrangedHere.current = false;
        setDiagram(fresh);
        return;
      }
      const { settings } = arrange;
      const signature = arrangeSignature(fresh, settings);
      if (arranged?.signature === signature) {
        arranged = { signature, diagram: withContentOf(arranged.diagram, fresh) };
        arrangedHere.current = true;
        setDiagram(arranged.diagram);
        return;
      }
      arrangePreviewDiagram(fresh, settings).then(
        (diagram) => {
          if (current !== run) return;
          arranged = { signature, diagram };
          arrangedHere.current = true;
          setDiagram(diagram);
        },
        (error: unknown) => {
          // Something to read beats nothing: the host's own positions.
          console.warn("[Structura] embed: could not arrange the preview", error);
          if (current !== run) return;
          arrangedHere.current = false;
          setDiagram(fresh);
        },
      );
    };

    const onMessage = (event: MessageEvent) => {
      const message = readEmbedMessage(event.data);
      if (!message) return;
      if (message.type === LOAD_GRAPH) {
        const changed = changedComponentIds(lastGraph.current, message.graph);
        lastGraph.current = message.graph;
        if (message.arrange) arrange = message.arrange;
        show(message.graph);
        setBlocked(null);
        if (changed.length > 0) setFocus((f) => ({ ids: changed, token: (f?.token ?? 0) + 1 }));
      } else if (message.type === ARRANGE) {
        // Asked again: arrange from scratch, even when nothing changed.
        arrange = message.arrange;
        arranged = null;
        if (lastGraph.current) show(lastGraph.current);
      } else if (message.type === SEARCH) setSearchRequest((n) => n + 1);
      else if (message.type === SELECT) {
        const { element } = message;
        setSelect((s) => ({
          element: element && { kind: element.kind, id: element.key },
          token: (s?.token ?? 0) + 1,
        }));
      } else if (message.type === BLOCKED) {
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
          blocked: document.querySelector("[data-embed-blocked]") !== null,
          selected: [...document.querySelectorAll<HTMLElement>(".react-flow__node.selected")].map(
            (node) => node.dataset["id"],
          ),
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
          arranged: arrangedHere.current,
        }),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [diagram]);

  /** The host's name for an element: a reference the arrangement made is its original there. */
  const hostRef = useCallback((element: ViewerElementRef) => {
    const component =
      element.kind === "component" ? shown.current?.snapshot.components[element.id] : undefined;
    const key = component && isSharedRefComponent(component) ? component.refOf : element.id;
    return { kind: element.kind, key };
  }, []);

  const reveal = useCallback(
    (element: ViewerElementRef) => postToHost({ type: REVEAL, element: hostRef(element) }),
    [hostRef],
  );

  const open = useCallback(
    (element: ViewerElementRef) => postToHost({ type: OPEN, element: hostRef(element) }),
    [hostRef],
  );

  const openProblem = (index: number) => postToHost({ type: OPEN_PROBLEM, index });

  if (!diagram) {
    if (blocked) {
      return (
        <div data-embed-blocked className="flex h-screen items-center justify-center p-6">
          <div className="max-w-xl space-y-3 text-sm">
            <p className="font-medium text-destructive">
              {blocked.reason === "parse"
                ? t("embedPage.blockedParse")
                : t("embedPage.blockedTitle", { count: blocked.errors })}
            </p>
            {blocked.problems.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-muted-foreground">
                {blocked.problems.map((problem, index) => (
                  <li key={problem}>
                    <button
                      type="button"
                      className="text-left hover:text-foreground hover:underline"
                      onClick={() => openProblem(index)}
                    >
                      {problem}
                    </button>
                  </li>
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
          data-embed-blocked
          className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-destructive/40 bg-card text-xs text-destructive shadow"
        >
          {/* To the first problem: what to fix to get the picture moving again. */}
          <button
            type="button"
            className="px-3 py-1.5 hover:underline"
            onClick={() => openProblem(0)}
          >
            {blocked.reason === "parse"
              ? t("embedPage.blockedStaleParse")
              : t("embedPage.blockedStale", { count: blocked.errors })}
          </button>
        </div>
      )}
      <ViewerCanvas
        diagram={diagram}
        showOpenInStructuraButton={false}
        searchable
        searchRequest={searchRequest}
        focus={focus}
        onElementClick={reveal}
        onElementDoubleClick={open}
        select={select}
      />
    </div>
  );
}
