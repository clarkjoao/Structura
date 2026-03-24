import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";

/**
 * Node ids with remote layout updates from Yjs.
 * Consumed by useLocalNodes to accept remote position updates.
 */
export const remoteLayoutUpdates = new Set<string>();

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

    const unsubscribeStore = useDiagramStore.subscribe((state, previousState) => {
      if (isApplyingRemoteRef.current) return;

      const diagramId = state.activeDiagramId;
      if (!diagramId) return;

      const diagram = state.diagrams[diagramId];
      const previousDiagram = previousState.diagrams[diagramId];
      if (!diagram) return;
      if (diagram === previousDiagram) return;

      const components = diagram.snapshot.components;
      const connections = diagram.snapshot.connections;
      const flows = diagram.snapshot.flows;
      const nodeLayouts = diagram.nodeLayouts;

      ydoc.transact(() => {
        metaMap.set("diagramId", diagramId);
        metaMap.set("diagramName", diagram.name);
        metaMap.set("level", diagram.level);

        const remoteComponentIds = new Set(componentsMap.keys());
        for (const [componentId, component] of Object.entries(components)) {
          const serializedComponent = JSON.stringify(component);
          if (componentsMap.get(componentId) !== serializedComponent) {
            componentsMap.set(componentId, serializedComponent);
          }
        }
        for (const componentId of remoteComponentIds) {
          if (!components[componentId]) componentsMap.delete(componentId);
        }

        const remoteConnectionIds = new Set(connectionsMap.keys());
        for (const [connectionId, connection] of Object.entries(connections)) {
          const serializedConnection = JSON.stringify(connection);
          if (connectionsMap.get(connectionId) !== serializedConnection) {
            connectionsMap.set(connectionId, serializedConnection);
          }
        }
        for (const connectionId of remoteConnectionIds) {
          if (!connections[connectionId]) connectionsMap.delete(connectionId);
        }

        const remoteNodeLayoutIds = new Set(nodeLayoutsMap.keys());
        for (const [nodeId, nodeLayout] of Object.entries(nodeLayouts)) {
          const serializedNodeLayout = JSON.stringify(nodeLayout);
          if (nodeLayoutsMap.get(nodeId) !== serializedNodeLayout) {
            nodeLayoutsMap.set(nodeId, serializedNodeLayout);
          }
        }
        for (const nodeId of remoteNodeLayoutIds) {
          if (!nodeLayouts[nodeId]) nodeLayoutsMap.delete(nodeId);
        }

        const remoteFlowIds = new Set(flowsMap.keys());
        for (const [flowId, flow] of Object.entries(flows)) {
          const serializedFlow = JSON.stringify(flow);
          if (flowsMap.get(flowId) !== serializedFlow) {
            flowsMap.set(flowId, serializedFlow);
          }
        }
        for (const flowId of remoteFlowIds) {
          if (!flows[flowId]) flowsMap.delete(flowId);
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

        const currentLayouts = diagram.nodeLayouts;
        for (const [layoutId, newLayoutValue] of Object.entries(nodeLayouts)) {
          const newLayout = newLayoutValue as { x: number; y: number };
          const currentLayout = currentLayouts[layoutId] as { x: number; y: number } | undefined;
          if (!currentLayout || currentLayout.x !== newLayout.x || currentLayout.y !== newLayout.y) {
            remoteLayoutUpdates.add(layoutId);
          }
        }

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
