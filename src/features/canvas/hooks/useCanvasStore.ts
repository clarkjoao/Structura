import {
  useActiveDiagramModel,
  useDiagrams,
  useVisibleComponents,
  useVisibleConnections,
  useServiceRegistry,
  useDiagramActions,
  useFlows,
} from "@/features/diagram";
import { useStableListByRefEquality } from "./useStableListByRefEquality";

const EMPTY_REGISTRY: Record<string, never> = {};

export function useCanvasStore() {
  const diagram = useActiveDiagramModel();
  const allDiagrams = useDiagrams();
  const visibleComponentsRaw = useVisibleComponents();
  const visibleConnectionsRaw = useVisibleConnections();
  const visibleComponents = useStableListByRefEquality(visibleComponentsRaw);
  const visibleConnections = useStableListByRefEquality(visibleConnectionsRaw);
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
