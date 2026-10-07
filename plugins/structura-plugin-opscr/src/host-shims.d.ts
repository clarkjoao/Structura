// The synced plugin.types.ts names one host-only type for node-type plugins; this plugin
// registers no node types, so it only has to resolve.
declare module "@/features/canvas" {
  export type DiagramNodeComponent = unknown;
}
