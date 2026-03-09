// Re-exports for backward compatibility. Prefer importing from @/features/diagram or @/features/registry.
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
  useDiagramActions,
} from "@/features/diagram";
export type { DiagramStore } from "@/features/diagram";
