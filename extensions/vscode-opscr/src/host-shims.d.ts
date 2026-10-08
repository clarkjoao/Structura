// The engine's copy of the plugin types names two host-only modules for UI contributions the
// extension never makes; they only have to resolve.
declare module "@/features/canvas" {
  export type DiagramNodeComponent = unknown;
}
declare module "react" {
  export type ComponentType<P = unknown> = (props: P) => unknown;
}
