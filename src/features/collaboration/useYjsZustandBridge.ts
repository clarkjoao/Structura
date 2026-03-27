import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import type { Component, Connection, Flow, IconDefinition, NodeLayout, EdgeLayout, SceneDiff } from "@/features/diagram";

/**
 * Node ids with remote layout updates from Yjs.
 * Consumed by useLocalNodes to accept remote position updates.
 */
export const remoteLayoutUpdates = new Set<string>();

// ── Lightweight validation ──────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidComponent(value: unknown): value is Component {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" && typeof value.type === "string";
}

function isValidConnection(value: unknown): value is Connection {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.sourceId === "string" &&
    typeof value.targetId === "string"
  );
}

function isValidFlow(value: unknown): value is Flow {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string";
}

function isValidNodeLayout(value: unknown): value is NodeLayout {
  if (!isRecord(value)) return false;
  return (
    typeof value.elementId === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function isValidIconDefinition(value: unknown): value is IconDefinition {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" && isRecord(value.source);
}

function isValidSceneDiff(value: unknown): value is SceneDiff {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" && typeof value.color === "string";
}

// ── Map parsing with validation ─────────────────────────────────────────────

function parseMapEntries<T>(
  map: Y.Map<unknown>,
  validator: (v: unknown) => v is T,
): Record<string, T> {
  const values: Record<string, T> = {};
  map.forEach((rawValue, key) => {
    if (typeof rawValue !== "string") return;
    try {
      const parsed = JSON.parse(rawValue);
      if (validator(parsed)) {
        values[key] = parsed;
      }
    } catch {
      // Ignore malformed payloads from peers.
    }
  });
  return values;
}

// ── Sync helpers for Y.Map ↔ Record ─────────────────────────────────────────

function syncMapToYjs<T>(
  ymap: Y.Map<unknown>,
  local: Record<string, T>,
) {
  const remoteIds = new Set(ymap.keys());
  for (const [id, entry] of Object.entries(local)) {
    const serialized = JSON.stringify(entry);
    if (ymap.get(id) !== serialized) {
      ymap.set(id, serialized);
    }
  }
  for (const id of remoteIds) {
    if (!local[id]) ymap.delete(id);
  }
}

// ── Debounce via requestAnimationFrame ──────────────────────────────────────

function createRafDebounce() {
  let rafId: number | null = null;
  return {
    schedule(fn: () => void) {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        fn();
      });
    },
    cancel() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
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
    const edgeLayoutsArray = ydoc.getArray("edgeLayouts");
    const iconLibraryMap = ydoc.getMap("iconLibrary");
    const scenesMap = ydoc.getMap("scenes");
    const metaMap = ydoc.getMap("meta");

    const raf = createRafDebounce();

    const pushToYjs = () => {
      const state = useDiagramStore.getState();
      if (isApplyingRemoteRef.current) return;

      const diagramId = state.activeDiagramId;
      if (!diagramId) return;

      const diagram = state.diagrams[diagramId];
      if (!diagram) return;

      ydoc.transact(() => {
        // Meta
        metaMap.set("diagramId", diagramId);
        metaMap.set("diagramName", diagram.name);
        metaMap.set("level", diagram.level);
        metaMap.set("domain", diagram.domain ?? "");
        metaMap.set("description", diagram.description ?? "");
        metaMap.set("activeSceneId", diagram.activeSceneId ?? null);
        metaMap.set("compareSceneId", diagram.compareSceneId ?? null);

        // Snapshot maps
        syncMapToYjs(componentsMap, diagram.snapshot.components);
        syncMapToYjs(connectionsMap, diagram.snapshot.connections);
        syncMapToYjs(flowsMap, diagram.snapshot.flows);
        syncMapToYjs(iconLibraryMap, diagram.snapshot.iconLibrary);
        syncMapToYjs(nodeLayoutsMap, diagram.nodeLayouts);

        // Scenes
        const scenes = diagram.scenes ?? {};
        syncMapToYjs(scenesMap, scenes);

        // Edge layouts (serialized as single array entry)
        const serializedEdgeLayouts = JSON.stringify(diagram.edgeLayouts);
        const currentRemoteEdgeLayouts = edgeLayoutsArray.length > 0
          ? (edgeLayoutsArray.get(0) as string)
          : undefined;
        if (currentRemoteEdgeLayouts !== serializedEdgeLayouts) {
          edgeLayoutsArray.delete(0, edgeLayoutsArray.length);
          edgeLayoutsArray.push([serializedEdgeLayouts]);
        }
      });
    };

    let prevDiagramRef: unknown = undefined;
    const unsubscribeStore = useDiagramStore.subscribe((state, previousState) => {
      if (isApplyingRemoteRef.current) return;

      const diagramId = state.activeDiagramId;
      if (!diagramId) return;

      const diagram = state.diagrams[diagramId];
      const previousDiagram = previousState.diagrams[diagramId];
      if (!diagram) return;
      if (diagram === previousDiagram && diagram === prevDiagramRef) return;
      prevDiagramRef = diagram;

      raf.schedule(pushToYjs);
    });

    // Initial push so the host's state is in Y.Doc before any guest joins.
    pushToYjs();

    const applyRemote = () => {
      const currentDiagramId = useDiagramStore.getState().activeDiagramId ?? activeDiagramId;
      if (!currentDiagramId) return;

      isApplyingRemoteRef.current = true;
      try {
        const state = useDiagramStore.getState();
        const diagram = state.diagrams[currentDiagramId];
        if (!diagram) return;

        const components = parseMapEntries(componentsMap, isValidComponent);
        const connections = parseMapEntries(connectionsMap, isValidConnection);
        const nodeLayouts = parseMapEntries(nodeLayoutsMap, isValidNodeLayout);
        const flows = parseMapEntries(flowsMap, isValidFlow);
        const iconLibrary = parseMapEntries(iconLibraryMap, isValidIconDefinition);
        const scenes = parseMapEntries(scenesMap, isValidSceneDiff);

        if (Object.keys(components).length === 0 && Object.keys(connections).length === 0) return;

        const currentLayouts = diagram.nodeLayouts;
        for (const [layoutId, newLayoutValue] of Object.entries(nodeLayouts)) {
          const newLayout = newLayoutValue as { x: number; y: number };
          const currentLayout = currentLayouts[layoutId] as { x: number; y: number } | undefined;
          if (!currentLayout || currentLayout.x !== newLayout.x || currentLayout.y !== newLayout.y) {
            remoteLayoutUpdates.add(layoutId);
          }
        }

        // Parse remote edge layouts
        let remoteEdgeLayouts: EdgeLayout[] | undefined;
        if (edgeLayoutsArray.length > 0) {
          try {
            remoteEdgeLayouts = JSON.parse(edgeLayoutsArray.get(0) as string);
          } catch {
            // Ignore malformed edge layouts from peers.
          }
        }

        // Parse remote metadata
        const remoteName = metaMap.get("diagramName");
        const remoteDomain = metaMap.get("domain");
        const remoteDescription = metaMap.get("description");
        const remoteActiveSceneId = metaMap.get("activeSceneId");
        const remoteCompareSceneId = metaMap.get("compareSceneId");

        useDiagramStore.setState((previousState) => {
          const prev = previousState.diagrams[currentDiagramId];
          return {
            ...previousState,
            diagrams: {
              ...previousState.diagrams,
              [currentDiagramId]: {
                ...prev,
                ...(typeof remoteName === "string" && remoteName ? { name: remoteName } : {}),
                ...(typeof remoteDomain === "string" ? { domain: remoteDomain || undefined } : {}),
                ...(typeof remoteDescription === "string" ? { description: remoteDescription || undefined } : {}),
                ...(remoteActiveSceneId !== undefined ? { activeSceneId: remoteActiveSceneId as string | null } : {}),
                ...(remoteCompareSceneId !== undefined ? { compareSceneId: remoteCompareSceneId as string | null } : {}),
                snapshot: {
                  ...prev.snapshot,
                  components: components as typeof diagram.snapshot.components,
                  connections: connections as typeof diagram.snapshot.connections,
                  flows: flows as typeof diagram.snapshot.flows,
                  iconLibrary: iconLibrary as typeof diagram.snapshot.iconLibrary,
                },
                nodeLayouts: nodeLayouts as typeof diagram.nodeLayouts,
                ...(remoteEdgeLayouts ? { edgeLayouts: remoteEdgeLayouts } : {}),
                ...(Object.keys(scenes).length > 0 ? { scenes: scenes as Record<string, SceneDiff> } : {}),
              },
            },
          };
        });
      } finally {
        isApplyingRemoteRef.current = false;
      }
    };

    const bootstrapObserver = () => {
      const remoteDiagramId = metaMap.get("diagramId");
      if (typeof remoteDiagramId !== "string") return;

      // Guard the entire bootstrap so the Zustand→Yjs subscriber does NOT
      // react to the empty diagram creation and wipe the host's data.
      isApplyingRemoteRef.current = true;
      try {
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
                edgeLayouts: [],
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
      } finally {
        isApplyingRemoteRef.current = false;
      }

      applyRemote();
    };

    metaMap.observe(bootstrapObserver);
    componentsMap.observe(applyRemote);
    connectionsMap.observe(applyRemote);
    flowsMap.observe(applyRemote);
    nodeLayoutsMap.observe(applyRemote);
    edgeLayoutsArray.observe(applyRemote);
    iconLibraryMap.observe(applyRemote);
    scenesMap.observe(applyRemote);

    return () => {
      raf.cancel();
      unsubscribeStore();
      metaMap.unobserve(bootstrapObserver);
      componentsMap.unobserve(applyRemote);
      connectionsMap.unobserve(applyRemote);
      flowsMap.unobserve(applyRemote);
      nodeLayoutsMap.unobserve(applyRemote);
      edgeLayoutsArray.unobserve(applyRemote);
      iconLibraryMap.unobserve(applyRemote);
      scenesMap.unobserve(applyRemote);
    };
  }, [ydoc, activeDiagramId]);
}
