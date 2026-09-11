import { createContext, useContext } from "react";
import { useComponentIcon, type IconDefinition } from "@/features/diagram";

export type ComponentIconLookup = (componentId: string) => IconDefinition | null;

export const ComponentIconLookupContext = createContext<ComponentIconLookup | null>(null);

/**
 * Custom icon for a node: payload lookup when the viewer provided one,
 * otherwise the workspace store the editor already uses.
 *
 * @example
 * const icon = useResolvedComponentIcon(elementId);
 */
export function useResolvedComponentIcon(componentId: string): IconDefinition | null {
  const lookup = useContext(ComponentIconLookupContext);
  const storeIcon = useComponentIcon(componentId);
  if (lookup) return lookup(componentId);
  return storeIcon;
}
