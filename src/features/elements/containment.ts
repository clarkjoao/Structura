import type { Component } from "@/features/diagram/model/component.types";
import { getElement } from "./element.registry";

/**
 * Typed containers — a parent that knows which children it takes and can be
 * drawn compact. The pattern the api-group started (endpoints inside a group),
 * made a contract of the registry: `canvas.acceptsChildren` and
 * `canvas.collapsible`.
 */

/** Whether `type` is a container that names the children it takes. */
export function isTypedContainerType(type: string): boolean {
  return getElement(type)?.canvas.acceptsChildren !== undefined;
}

/**
 * Whether a `childType` node may be nested in a `parentType` node.
 *
 * A type that cannot be a parent takes nothing; a container that does not list
 * its children takes anything (a panel, an api-group — as they always have).
 * An unknown parent type (a plugin) is not second-guessed here.
 */
export function canContain(parentType: string, childType: string): boolean {
  const parent = getElement(parentType);
  if (!parent) return true;
  if (!parent.canvas.canBeParent) return false;
  const accepted = parent.canvas.acceptsChildren;
  return accepted === undefined || accepted.includes(childType);
}

/**
 * Whether the component is a container drawn compact right now. Only a
 * `collapsible` type counts: a panel's own `collapsed` keeps its old meaning.
 */
export function isCompactContainer(comp: Component): boolean {
  if ((comp as { collapsed?: boolean }).collapsed !== true) return false;
  return getElement(comp.type)?.canvas.collapsible === true;
}
