import {
  useActiveDiagramModel,
  useDiagrams,
  useVisibleComponents,
  useVisibleConnections,
  useServices,
  useDiagramActions,
  useFlows,
} from "@/features/diagram";
import { useTextToolStore } from "../text/textLayer.store";

const EMPTY_SERVICES: Record<string, never> = {};

export function useCanvasStore() {
  const diagram = useActiveDiagramModel();
  const allDiagrams = useDiagrams();
  // Selectors now memoize their own arrays — no wrapper needed.
  const textsVisible = useTextToolStore((state) => state.layerVisible);
  const visibleComponents = useVisibleComponents({ textsVisible });
  const visibleConnections = useVisibleConnections();
  const services = useServices();
  const flows = useFlows();
  const actions = useDiagramActions();

  const stableServices = services ?? EMPTY_SERVICES;

  return {
    diagram,
    allDiagrams,
    visibleComponents,
    visibleConnections,
    services: stableServices,
    flows,
    actions,
  };
}
