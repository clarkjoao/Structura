import type { Component, ComponentPatch } from "../model/component.types";
import type { ServiceDefinition } from "../model/service.types";
import { ServiceSource } from "../enums";

/** A service's technology list as an element's technology field says it, and back. */
export function splitTechnology(technology: string | undefined): string[] {
  return (technology ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * The registry is the golden source for the fields a service lends an element — name, description,
 * technology, tags. An edit to one of them on a linked element is an edit to the service (which
 * then reaches every element linked to it), so it is translated to the service's own shape.
 * Empty when the patch touches none of them.
 */
export function serviceEditOf(patch: ComponentPatch): Partial<Omit<ServiceDefinition, "id">> {
  const edit: Partial<Omit<ServiceDefinition, "id">> = {};
  if (patch.name !== undefined) edit.name = patch.name;
  if (patch.description !== undefined) edit.description = patch.description;
  if ("technology" in patch) {
    edit.technology = splitTechnology((patch as { technology?: string }).technology);
  }
  if ("tags" in patch) edit.tags = patch.tags ?? [];
  return edit;
}

/**
 * A new service made from an element, so that linking it hands the element its own data back
 * instead of overwriting it with a blank record.
 */
export function serviceSeedFromComponent(
  component: Component,
  name = component.name,
): Omit<ServiceDefinition, "id"> {
  const technology =
    "technology" in component
      ? splitTechnology((component as { technology?: string }).technology)
      : [];
  return {
    name,
    description: component.description ?? "",
    repositoryUrl: "",
    technology,
    tags: component.tags ?? [],
    ...(component.externalLinks?.length
      ? { externalLinks: component.externalLinks.map((link) => ({ ...link })) }
      : {}),
    sources: [{ type: ServiceSource.Manual }],
  };
}
