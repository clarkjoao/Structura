import type { Connection } from "../model/connection.types";
import type {
  Component,
  K8sContainerComponent,
  K8sContainerRole,
  K8sWorkloadComponent,
} from "../model/component.types";
import type { NodeLayout } from "../model/layout.types";
import { StrokeStyle } from "../enums";
import { isK8sContainerComponent, isK8sNamespaceComponent } from "../model/component.guards";

/*
 * A workload's pod template, read from its container children — who is
 * main, who rides along as a sidecar, what runs first — and what the mesh
 * adds to it. Derived, never stored.
 */

export const DEFAULT_CONTAINER_ROLE: K8sContainerRole = "main";
/** The sidecar functions the inspector offers; any other text is kept as typed. */
export const SIDECAR_PURPOSES = ["proxy", "logs", "secrets", "metrics"] as const;

export function containerRole(container: K8sContainerComponent): K8sContainerRole {
  return container.podRole ?? DEFAULT_CONTAINER_ROLE;
}

export interface PodContainers {
  main: K8sContainerComponent[];
  /** Top to bottom as they sit in the workload, then by name. */
  sidecars: K8sContainerComponent[];
  /** In run order: `order`, then top to bottom. */
  inits: K8sContainerComponent[];
}

/** The workload's containers by role. Only its direct children that are containers. */
export function podContainers(
  workloadId: string,
  components: Record<string, Component>,
  layouts: Record<string, NodeLayout> = {},
): PodContainers {
  const pod: PodContainers = { main: [], sidecars: [], inits: [] };
  for (const component of Object.values(components)) {
    if (component.parentId !== workloadId || !isK8sContainerComponent(component)) continue;
    const role = containerRole(component);
    if (role === "sidecar") pod.sidecars.push(component);
    else if (role === "init") pod.inits.push(component);
    else pod.main.push(component);
  }
  const y = (c: K8sContainerComponent) => layouts[c.id]?.y ?? 0;
  const byPlace = (a: K8sContainerComponent, b: K8sContainerComponent) =>
    y(a) - y(b) || a.name.localeCompare(b.name);
  pod.sidecars.sort(byPlace);
  pod.main.sort(byPlace);
  pod.inits.sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || byPlace(a, b),
  );
  return pod;
}

/** "sidecar · proxy", or just "sidecar" when it has no function yet. */
export function sidecarCaption(container: K8sContainerComponent, sidecarWord: string): string {
  const purpose = container.purpose?.trim();
  return purpose ? `${sidecarWord} · ${purpose}` : sidecarWord;
}

/** Whether the workload sits in a namespace whose mesh injects sidecars. */
export function isMeshed(
  workload: K8sWorkloadComponent,
  components: Record<string, Component>,
): boolean {
  let current = workload.parentId;
  const seen = new Set<string>([workload.id]);
  while (current && !seen.has(current)) {
    seen.add(current);
    const component = components[current];
    if (!component) return false;
    if (isK8sNamespaceComponent(component)) return component.meshInjection === true;
    current = component.parentId;
  }
  return false;
}

/** A link between two containers of the same pod: sidecar ↔ main, say. */
export function isInPodLink(
  connection: Connection,
  components: Record<string, Component>,
): boolean {
  const source = components[connection.sourceId];
  const target = components[connection.targetId];
  return (
    !!source &&
    !!target &&
    isK8sContainerComponent(source) &&
    isK8sContainerComponent(target) &&
    source.parentId !== null &&
    source.parentId === target.parentId
  );
}

/** Teal, the sidecar's colour: what an in-pod link is drawn in. */
export const POD_LINK_COLOR = "hsl(var(--node-system))";

/**
 * How an in-pod link is drawn when nobody styled it: dashed teal — a normal
 * edge, the style derived at draw time and never written. A stroke or a
 * colour the author chose wins.
 */
export function withPodLinkStyle(
  connection: Connection,
  components: Record<string, Component>,
): Connection {
  if (!isInPodLink(connection, components)) return connection;
  const style = connection.style ?? {};
  if (style.strokeStyle !== undefined && style.color !== undefined) return connection;
  return {
    ...connection,
    style: {
      ...style,
      strokeStyle: style.strokeStyle ?? StrokeStyle.Dashed,
      color: style.color ?? POD_LINK_COLOR,
    },
  };
}
