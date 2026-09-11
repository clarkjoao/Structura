import type { ReactNode } from "react";
import { ComponentIconLookupContext, type ComponentIconLookup } from "./componentIconLookupContext";

interface ComponentIconLookupProviderProps {
  lookup: ComponentIconLookup;
  children: ReactNode;
}

/**
 * Supplies a diagram-scoped icon lookup. When mounted, nodes ignore the
 * persisted workspace library and ask this function instead.
 *
 * @example
 * <ComponentIconLookupProvider lookup={iconLookupForDiagram(diagram)}>
 *   <ReactFlow />
 * </ComponentIconLookupProvider>
 */
export function ComponentIconLookupProvider({
  lookup,
  children,
}: ComponentIconLookupProviderProps) {
  return (
    <ComponentIconLookupContext.Provider value={lookup}>
      {children}
    </ComponentIconLookupContext.Provider>
  );
}
