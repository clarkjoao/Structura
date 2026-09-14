// App-boot side effect (imported from main.tsx, like features/cloud/bootstrap):
// registering at module scope is what lets `sanitizeComponentType` and the
// store consult the registry during rehydrate, before any React tree exists.
import type { ElementDescriptor } from "./element.types";
import { registerElement, hasElement } from "./element.registry";
import { jsonViewerElement } from "./structural/json-viewer.element";

const BUILT_IN_ELEMENTS: ElementDescriptor[] = [jsonViewerElement];

for (const element of BUILT_IN_ELEMENTS) {
  // Idempotent: vitest can evaluate this module more than once per worker.
  if (!hasElement(element.id)) registerElement(element);
}
