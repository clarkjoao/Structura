import {
  useActiveDiagramModel,
  useDiagrams,
  useVisibleComponents,
  useVisibleConnections,
  useServiceRegistry,
  useDiagramActions,
  useFlows,
} from "@/features/diagram";

const EMPTY_REGISTRY: Record<string, never> = {};

export function useCanvasStore() {
  const diagram = useActiveDiagramModel();
  const allDiagrams = useDiagrams();
  // Selectors now memoize their own arrays — no wrapper needed.
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const serviceCatalog = useServiceRegistry();
  const flows = useFlows();
  const actions = useDiagramActions();

  const stableRegistry = serviceCatalog ?? EMPTY_REGISTRY;

  return {
    diagram,
    allDiagrams,
    visibleComponents,
    visibleConnections,
    serviceCatalog: stableRegistry,
    flows,
    actions,
  };
}
