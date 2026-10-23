import type { Component } from "@/features/diagram/model/component.types";
import type { Connection } from "@/features/diagram/model/connection.types";
import { isPanelComponent } from "@/features/diagram/model/component.guards";
import { isTextType } from "@/features/diagram/model/component-type-constants";

/**
 * What the layout reads of a diagram's structure, as one comparable string:
 * which elements exist and what they nest in, which panels are collapsed, and
 * which connections join what. Two snapshots with the same signature lay out
 * the same; a move, a resize, a rename or a restyle leaves it unchanged.
 *
 * The automatic mode re-arranges when this changes. Free text is left out, as
 * the layout leaves it out.
 */
export function structuralSignature(snapshot: {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
}): string {
  const elements: string[] = [];
  for (const component of Object.values(snapshot.components)) {
    if (isTextType(component.type)) continue;
    const collapsed = isPanelComponent(component) && component.collapsed === true ? "^" : "";
    elements.push(`${component.id}<${component.parentId ?? ""}${collapsed}`);
  }
  const links: string[] = [];
  for (const connection of Object.values(snapshot.connections)) {
    links.push(`${connection.id}:${connection.sourceId}>${connection.targetId}`);
  }
  elements.sort();
  links.sort();
  return `${elements.join("|")}#${links.join("|")}`;
}
