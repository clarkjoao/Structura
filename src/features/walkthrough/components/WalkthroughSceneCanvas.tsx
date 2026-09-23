import { useMemo, type ComponentProps } from "react";
import { ViewerCanvas, useStoreReaderCatalog } from "@/features/viewer";

type WalkthroughSceneCanvasProps = Omit<ComponentProps<typeof ViewerCanvas>, "catalog">;

/**
 * A walkthrough scene's diagram, read.
 *
 * On the base, whatever scene the author last had open in the editor: a
 * walkthrough names a diagram and a flow, its scripts were written against the
 * base, and which scene the editor happened to be left in is not part of the
 * presentation. The names its cards show come from the store, as the editor's do.
 */
export function WalkthroughSceneCanvas({ diagram, ...props }: WalkthroughSceneCanvasProps) {
  const onBase = useMemo(() => ({ ...diagram, activeVersionId: null }), [diagram]);
  const catalog = useStoreReaderCatalog(onBase);
  return <ViewerCanvas diagram={onBase} catalog={catalog} {...props} />;
}
