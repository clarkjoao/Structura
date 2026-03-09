// Re-exports for backward compatibility. Prefer importing from @/features/diagram or @/features/registry.
export type {
  ComponentType,
  Level,
  Component,
  Connection,
  ViewNodeLayout,
  FlowStep,
  Flow,
  ModelDraft,
  Diagram,
} from "@/features/diagram";
export type { ServiceDefinition } from "@/features/registry";
export { generateId } from "@/features/diagram";
