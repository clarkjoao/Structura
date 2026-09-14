/**
 * Cohesive interaction policy for DiagramSurface.
 *
 * One discriminant — not a pile of enable/disable props. Hosts derive this from
 * product state (e.g. `canEditCanvas`); the core never learns about workspace,
 * LLM, or share routes.
 *
 * @example
 * writePolicy(interactionMode.canEditCanvas)
 * readPolicy()
 */
export type DiagramSurfaceKind = "write" | "read";

export interface DiagramSurfacePolicy {
  kind: DiagramSurfaceKind;
  /**
   * Whether the graph accepts drag / connect / selection.
   * Write host: mirrors `InteractionMode.canEditCanvas`.
   * Read host: always false.
   */
  graphInteractive: boolean;
}

export function writePolicy(graphInteractive: boolean): DiagramSurfacePolicy {
  return { kind: "write", graphInteractive };
}

export function readPolicy(): DiagramSurfacePolicy {
  return { kind: "read", graphInteractive: false };
}
