import { useMemo } from 'react';
import { useDiagramStore } from '@/features/diagram';
import type { Component, Connection } from '@/features/diagram';

/**
 * Centraliza acesso ao store com seletores otimizados
 */
export const useCanvasStore = () => {
  const diagramId = useDiagramStore(state => state.activeDiagramId);

  const activeDiag = useDiagramStore(state =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId] : null
  );

  const nodes = useMemo(() => {
    if (!activeDiag) return [];
    return Object.values(activeDiag.snapshot.components)
      .filter((c: Component) => !c.parentId);
  }, [activeDiag]);

  const edges = useMemo(() => {
    if (!activeDiag) return [];
    return Object.values(activeDiag.snapshot.connections).map((conn: Connection) => ({
      id: conn.id,
      source: conn.fromComponentId,
      target: conn.toComponentId,
      style: conn.style,
    }));
  }, [activeDiag]);

  const nodeLayouts = activeDiag?.snapshot.nodeLayouts ?? [];
  const viewport = activeDiag?.snapshot.viewport;

  const updateComponent = useDiagramStore(state => state.updateComponent);
  const updateNodeLayout = useDiagramStore(state => state.updateNodeLayout);
  const updateViewport = useDiagramStore(state => state.updateViewport);
  const addConnection = useDiagramStore(state => state.addConnection);
  const removeComponent = useDiagramStore(state => state.removeComponent);
  const undo = useDiagramStore(state => state.undo);
  const redo = useDiagramStore(state => state.redo);

  return useMemo(() => ({
    diagramId,
    nodes,
    edges,
    nodeLayouts,
    viewport,
    actions: {
      updateComponent,
      updateNodeLayout,
      updateViewport,
      addConnection,
      removeComponent,
      undo,
      redo,
    },
  }), [diagramId, nodes, edges, nodeLayouts, viewport, updateComponent, updateNodeLayout, updateViewport, addConnection, removeComponent, undo, redo]);
};
