/**
 * SPIKE — read-only preview entry with no router, for a VSCode webview.
 *
 * Listens for STRUCTURA_LOAD_GRAPH { components, connections } in importer-result shape
 * (plugin API 1.3), builds a diagram in an in-memory store and renders it read-only.
 * Every new message rebuilds the diagram: that is the live-update path.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
// Viewer cards call useNavigate (badges link to linked diagrams): they need a router context.
import { MemoryRouter } from "react-router-dom";
import "@/infrastructure/i18n/i18n";
import "@/features/cloud/bootstrap";
import "@/features/elements/bootstrap";
import "@/index.css";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { createDiagramStore } from "@/features/diagram/store/diagram.store";
import type { Diagram } from "@/features/diagram";
import type { GeneratedNodeInput } from "@/features/diagram/store/slices/generated-graph.slice";
import { ViewerCanvas } from "@/features/viewer";
import type { ImportResult } from "@/features/plugins/plugin.types";

const store = createDiagramStore(new InMemoryAdapter());

function build(result: Pick<ImportResult, "components" | "connections">): Diagram {
  const s = store.getState();
  const d = s.addDiagram("preview", "container");
  s.openDiagram(d.id);
  const nodes: GeneratedNodeInput[] = result.components.map((c) => ({
    externalId: c.key,
    type: (c.type ?? "unknown") as GeneratedNodeInput["type"],
    name: c.name,
    description: c.description,
    parentExternalId: c.parentKey ?? null,
    ...(c.cloudServiceId ? { cloudServiceId: c.cloudServiceId } : {}),
    ...(c.technology ? { technology: c.technology } : {}),
    x: c.x,
    y: c.y,
    ...(c.width !== undefined ? { width: c.width, height: c.height } : {}),
  }));
  s.insertGeneratedGraph(
    nodes,
    result.connections.map((c) => ({
      sourceExternalId: c.source,
      targetExternalId: c.target,
      label: c.label ?? "",
    })),
  );
  const diagram = store.getState().diagrams[d.id]!;
  return diagram;
}

function Preview() {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "STRUCTURA_LOAD_GRAPH") return;
      const t0 = performance.now();
      setDiagram(build(event.data));
      (window as unknown as { __lastBuildMs: number }).__lastBuildMs = performance.now() - t0;
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "STRUCTURA_READY" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);
  if (!diagram) return <div style={{ padding: 16 }}>waiting…</div>;
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ViewerCanvas key={diagram.id} diagram={diagram} showOpenInStructuraButton={false} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <Preview />
  </MemoryRouter>,
);
