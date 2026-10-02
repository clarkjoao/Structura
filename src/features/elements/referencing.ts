import type { Component } from "@/features/diagram/model/component.types";
import { isNoteComponent, isSharedRefComponent } from "@/features/diagram/model/component.guards";
import { getElement } from "./element.registry";

/**
 * Whether a reference may stand for `component`: something edges end on. A
 * frame (a panel), an annotation (a note) or a named line is never used by
 * anything, so it is never drawn where its users are. Nor is a reference: a
 * reference is only ever made of the original element.
 */
export function canBeReferenced(component: Component): boolean {
  if (isSharedRefComponent(component)) return false;
  if (isNoteComponent(component)) return false;
  return getElement(component.type)?.canvas.connectable === true;
}
