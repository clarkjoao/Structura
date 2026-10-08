import { useEffect, useMemo, useState } from "react";
import Canvas from "@/features/canvas/Canvas";
import { DiagramFlowProvider } from "@/features/canvas/core/DiagramFlowProvider";
import { FlowModeProvider } from "@/features/canvas/flow/FlowModeContext";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { createContributionTracker, createScopedPluginApi } from "@/features/plugins/plugin-api";
import type { PluginManifest } from "@/features/plugins/plugin.types";
import { postToHost } from "../protocol";
import {
  EDITOR_APPLIED,
  EDITOR_APPLY,
  EDITOR_READY,
  EDITOR_SNAPSHOT,
  readHostMessage,
} from "./protocol";

/** The host acts as a plugin over the bridge: same facade, same sanitization. */
const HOST_MANIFEST: PluginManifest = {
  id: "structura-embed-host",
  name: "Embed host",
  version: "1.0.0",
  author: "Structura",
  description: "The page or extension driving the editable embed",
  apiVersion: "^1.10",
  capabilities: ["diagram:read", "diagram:write", "events:diagram"],
};

/** One fresh diagram per load: whatever the frame's storage kept from a previous one goes. */
function openFreshDiagram(): string {
  const store = useDiagramStore.getState();
  for (const id of Object.keys(store.diagrams)) store.deleteDiagram(id);
  const created = useDiagramStore.getState().addDiagram("opscr", "container");
  useDiagramStore.getState().openDiagram(created.id);
  return created.id;
}

/**
 * The editable embed: Structura's own canvas on one in-memory diagram, driven by its host over
 * `postMessage` (./protocol.ts).
 */
export function EmbedEditor() {
  const [diagramId] = useState(openFreshDiagram);
  const api = useMemo(() => createScopedPluginApi(HOST_MANIFEST, createContributionTracker()), []);

  useEffect(() => {
    const sendSnapshot = () => {
      const diagram = api.getDiagram(diagramId);
      if (diagram) postToHost({ type: EDITOR_SNAPSHOT, diagram });
    };
    const unsubscribe = api.onDiagramChange((changed) => {
      if (changed === diagramId) sendSnapshot();
    });
    const onMessage = (event: MessageEvent) => {
      const message = readHostMessage(event.data);
      if (!message) return;
      if (message.type === EDITOR_APPLY) {
        const result = api.applyChanges(message.changes);
        postToHost({
          type: EDITOR_APPLIED,
          requestId: message.requestId,
          result,
          diagram: api.getDiagram(diagramId),
        });
      } else {
        document.documentElement.classList.toggle("dark", message.theme === "dark");
      }
    };
    window.addEventListener("message", onMessage);
    postToHost({ type: EDITOR_READY });
    sendSnapshot();
    return () => {
      unsubscribe();
      window.removeEventListener("message", onMessage);
    };
  }, [api, diagramId]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <FlowModeProvider>
        <DiagramFlowProvider>
          <Canvas />
        </DiagramFlowProvider>
      </FlowModeProvider>
    </div>
  );
}
