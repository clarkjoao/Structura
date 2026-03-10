// @deprecated — importe de @/features/diagram (ou @/features/registry). Este arquivo existe apenas para compatibilidade.
// throw new Error('Deprecated — import from @/features/diagram instead')
export type {
  ComponentType,
  Level,
  Component,
  Connection,
  ViewNodeLayout,
  FlowStep,
  Flow,
  ModelDraft,
  Folder,
  Diagram,
} from "@/features/diagram";
export type { ServiceDefinition } from "@/features/registry";
export { generateId } from "@/features/diagram";
