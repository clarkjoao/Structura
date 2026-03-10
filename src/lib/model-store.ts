// @deprecated — importe de @/features/diagram (ou @/features/registry). Este arquivo existe apenas para compatibilidade.
// throw new Error('Deprecated — import from @/features/diagram instead')
export {
  useDiagramStore,
  useDiagrams,
  useAllDiagrams,
  useActiveDiagramId,
  useActiveDiagram,
  useComponents,
  useComponent,
  useConnections,
  useVisibleComponents,
  useVisibleConnections,
  useCanNavigateInto,
  useServiceRegistry,
  useAllServices,
  useAllComponents,
  useAllConnections,
  useFlows,
  useAllComponentsAcrossDiagrams,
  useDiagramActions,
} from "@/features/diagram";
export type { DiagramStore } from "@/features/diagram";
