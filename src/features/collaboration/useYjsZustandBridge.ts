import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { resolveCanvasSnapshot } from "@/features/diagram";

function parseMapEntries(map: Y.Map<unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  map.forEach((rawValue, key) => {
    if (typeof rawValue !== "string") return;
    try {
      values[key] = JSON.parse(rawValue);
    } catch {
      // Ignore malformed payloads from peers.
    }
  });
  return values;
}

/**
 * Bidirectional bridge between Y.Doc and Zustand.
 *
 * Anti-loop guard must stay synchronous via useRef.
 */
export function useYjsZustandBridge(ydoc: Y.Doc | null, activeDiagramId: string | null) {
  const isApplyingRemoteRef = useRef(false);

  useEffect(() => {
    if (!ydoc || !activeDiagramId) return;

    const componentsMap = ydoc.getMap("components");
    const connectionsMap = ydoc.getMap("connections");
    const flowsMap = ydoc.getMap("flows");
    const nodeLayoutsMap = ydoc.getMap("nodeLayouts");
    const metaMap = ydoc.getMap("meta");

    const unsubscribeStore = useDiagramStore.subscribe((state) => {
      if (isApplyingRemoteRef.current) return;

      const diagramId = state.activeDiagramId;
      if (!diagramId) return;
      const diagram = state.diagrams[diagramId];
      if (!diagram) return;

      const snapshot = resolveCanvasSnapshot(diagram);

      ydoc.transact(() => {
        metaMap.set("diagramId", diagramId);
        metaMap.set("diagramName", diagram.name);
        metaMap.set("level", diagram.level);

        const remoteComponentIds = new Set(componentsMap.keys());
        const localComponentIds = new Set(Object.keys(snapshot.components));
        for (const [componentId, component] of Object.entries(snapshot.components)) {
          const serializedComponent = JSON.stringify(component);
          if (componentsMap.get(componentId) !== serializedComponent) {
            componentsMap.set(componentId, serializedComponent);
          }
        }
        for (const componentId of remoteComponentIds) {
          if (!localComponentIds.has(componentId)) componentsMap.delete(componentId);
        }

        const remoteConnectionIds = new Set(connectionsMap.keys());
        const localConnectionIds = new Set(Object.keys(snapshot.connections));
        for (const [connectionId, connection] of Object.entries(snapshot.connections)) {
          const serializedConnection = JSON.stringify(connection);
          if (connectionsMap.get(connectionId) !== serializedConnection) {
            connectionsMap.set(connectionId, serializedConnection);
          }
        }
        for (const connectionId of remoteConnectionIds) {
          if (!localConnectionIds.has(connectionId)) connectionsMap.delete(connectionId);
        }

        const remoteNodeLayoutIds = new Set(nodeLayoutsMap.keys());
        const localNodeLayoutIds = new Set(Object.keys(snapshot.nodeLayouts));
        for (const [nodeId, nodeLayout] of Object.entries(snapshot.nodeLayouts)) {
          const serializedNodeLayout = JSON.stringify(nodeLayout);
          if (nodeLayoutsMap.get(nodeId) !== serializedNodeLayout) {
            nodeLayoutsMap.set(nodeId, serializedNodeLayout);
          }
        }
        for (const nodeId of remoteNodeLayoutIds) {
          if (!localNodeLayoutIds.has(nodeId)) nodeLayoutsMap.delete(nodeId);
        }

        const remoteFlowIds = new Set(flowsMap.keys());
        const localFlowIds = new Set(Object.keys(diagram.snapshot.flows));
        for (const [flowId, flow] of Object.entries(diagram.snapshot.flows)) {
          const serializedFlow = JSON.stringify(flow);
          if (flowsMap.get(flowId) !== serializedFlow) {
            flowsMap.set(flowId, serializedFlow);
          }
        }
        for (const flowId of remoteFlowIds) {
          if (!localFlowIds.has(flowId)) flowsMap.delete(flowId);
        }
      });
    });

    const applyRemote = () => {
      const currentDiagramId = useDiagramStore.getState().activeDiagramId ?? activeDiagramId;
      if (!currentDiagramId) return;

      isApplyingRemoteRef.current = true;
      try {
        const state = useDiagramStore.getState();
        const diagram = state.diagrams[currentDiagramId];
        if (!diagram) return;

        const components = parseMapEntries(componentsMap);
        const connections = parseMapEntries(connectionsMap);
        const nodeLayouts = parseMapEntries(nodeLayoutsMap);
        const flows = parseMapEntries(flowsMap);

        if (Object.keys(components).length === 0 && Object.keys(connections).length === 0) return;

        useDiagramStore.setState((previousState) => ({
          ...previousState,
          diagrams: {
            ...previousState.diagrams,
            [currentDiagramId]: {
              ...previousState.diagrams[currentDiagramId],
              snapshot: {
                ...previousState.diagrams[currentDiagramId].snapshot,
                components: components as typeof diagram.snapshot.components,
                connections: connections as typeof diagram.snapshot.connections,
                flows: flows as typeof diagram.snapshot.flows,
              },
              nodeLayouts: nodeLayouts as typeof diagram.nodeLayouts,
            },
          },
        }));
      } finally {
        isApplyingRemoteRef.current = false;
      }
    };

    const bootstrapObserver = () => {
      const remoteDiagramId = metaMap.get("diagramId");
      if (typeof remoteDiagramId !== "string") return;

      const state = useDiagramStore.getState();
      if (!state.diagrams[remoteDiagramId]) {
        // Create guest diagram with the same host id so /model/<id> resolves.
        const remoteDiagramNameValue = metaMap.get("diagramName");
        const remoteDiagramName =
          typeof remoteDiagramNameValue === "string" ? remoteDiagramNameValue : "Shared Diagram";
        const remoteDiagramLevelValue = metaMap.get("level");
        const remoteDiagramLevel =
          typeof remoteDiagramLevelValue === "string" ? remoteDiagramLevelValue : "context";
        const currentTimestamp = new Date().toISOString();

        useDiagramStore.setState((previousState) => ({
          ...previousState,
          diagrams: {
            ...previousState.diagrams,
            [remoteDiagramId]: {
              id: remoteDiagramId,
              name: remoteDiagramName,
              level: remoteDiagramLevel,
              createdAt: currentTimestamp,
              updatedAt: currentTimestamp,
              snapshot: {
                components: {},
                connections: {},
                flows: {},
                iconLibrary: {},
              },
              nodeLayouts: {},
              viewport: { x: 0, y: 0, zoom: 1 },
            },
          },
          activeDiagramId: remoteDiagramId,
        }));
      } else if (state.activeDiagramId !== remoteDiagramId) {
        useDiagramStore.setState((previousState) => ({
          ...previousState,
          activeDiagramId: remoteDiagramId,
        }));
      }

      applyRemote();
    };

    metaMap.observe(bootstrapObserver);
    componentsMap.observe(applyRemote);
    connectionsMap.observe(applyRemote);
    flowsMap.observe(applyRemote);
    nodeLayoutsMap.observe(applyRemote);

    return () => {
      unsubscribeStore();
      metaMap.unobserve(bootstrapObserver);
      componentsMap.unobserve(applyRemote);
      connectionsMap.unobserve(applyRemote);
      flowsMap.unobserve(applyRemote);
      nodeLayoutsMap.unobserve(applyRemote);
    };
  }, [ydoc, activeDiagramId]);
}
