import {
  useActiveDiagram,
  useDiagrams,
  useVisibleComponents,
  useVisibleConnections,
  useServiceRegistry,
  useDiagramActions,
  useFlows,
} from "@/features/diagram";

const EMPTY_REGISTRY: Record<string, never> = {};

export function useCanvasStore() {
  const diagram = useActiveDiagram();
  const allDiagrams = useDiagrams();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const serviceRegistry = useServiceRegistry();
  const flows = useFlows();
  const actions = useDiagramActions();

  const stableRegistry = serviceRegistry ?? EMPTY_REGISTRY;

  return {
    diagram,
    allDiagrams,
    visibleComponents,
    visibleConnections,
    serviceRegistry: stableRegistry,
    flows,
    actions,
  };
}
