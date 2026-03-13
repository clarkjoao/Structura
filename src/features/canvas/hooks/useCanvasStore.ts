import { useCallback, useMemo } from 'react';
import { useDiagramStore } from '@/features/diagram';
/**
 * Centraliza acesso ao store com seletores otimizados
 * Evita re-renders desnecessários com useShallow
 */
export const useCanvasStore = () => {
  const diagramId = useDiagramStore(state => state.activeDiagram);
  const nodes = useDiagramStore(state => Object.values(state.snapshot.components)
    .filter(c => !c.parentId) // Top-level only (ReactFlow handles hierarchy)
  );
  const edges = useDiagramStore(state => Object.values(state.snapshot.connections).map(conn => ({
    id: conn.id,
    source: conn.fromComponentId,
    target: conn.toComponentId,
    style: conn.style,
  }))
  );
  const nodeLayouts = useDiagramStore(state => state.snapshot.nodeLayouts);
  const viewport = useDiagramStore(state => state.snapshot.viewport);

  // Actions com weak memoization
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