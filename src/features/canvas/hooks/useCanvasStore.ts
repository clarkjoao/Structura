/**
 * Centraliza acesso ao store do diagrama.
 * Separa claramente dados (store) vs estado visual (useCanvasVisualState).
 */
import {
  useActiveDiagram,
  useDiagrams,
  useVisibleComponents,
  useVisibleConnections,
  useServiceRegistry,
  useDiagramActions,
  useFlows,
} from "@/features/diagram";

export function useCanvasStore() {
  const diagram = useActiveDiagram();
  const allDiagrams = useDiagrams();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const serviceRegistry = useServiceRegistry();
  const flows = useFlows();
  const actions = useDiagramActions();

  return {
    diagram,
    allDiagrams,
    visibleComponents,
    visibleConnections,
    serviceRegistry: serviceRegistry ?? {},
    flows,
    actions,
  };
}
