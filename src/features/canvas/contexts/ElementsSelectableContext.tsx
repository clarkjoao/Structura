import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether the surface lets the reader select and edit elements — the same value
 * the surface hands `<ReactFlow elementsSelectable>`.
 *
 * It lives here rather than being read from React Flow's store by each edge.
 * `useStore` is a store subscription, and React Flow notifies every subscriber
 * on every store write, including the `setNodes` of each drag frame. One
 * subscription per visible edge for a value that is identical for all of them
 * cost 287 selector runs per drag frame on the 400-node fixture.
 *
 * The provider has to wrap `<ReactFlow>`, not sit inside it: edges are rendered
 * by React Flow's own renderer, so a child of `<ReactFlow>` is their sibling,
 * not their ancestor.
 *
 * The default matches React Flow's own (`elementsSelectable: true`), so a
 * surface that does not restrict interaction needs no provider.
 */
const ElementsSelectableContext = createContext<boolean>(true);

export function ElementsSelectableProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return (
    <ElementsSelectableContext.Provider value={value}>
      {children}
    </ElementsSelectableContext.Provider>
  );
}

export function useElementsSelectable(): boolean {
  return useContext(ElementsSelectableContext);
}
