// App-boot side effect (imported from main.tsx, like features/cloud/bootstrap):
// registering at module scope is what lets `sanitizeComponentType` and the
// store consult the registry during rehydrate, before any React tree exists.
import type { ElementDescriptor } from "./element.types";
import { registerElement, hasElement } from "./element.registry";
import { apiGroupElement } from "./structural/api-group.element";
import { dbTableElement } from "./structural/db-table.element";
import { endpointElement } from "./structural/endpoint.element";
import { jsonViewerElement } from "./structural/json-viewer.element";
import { noteElement } from "./structural/note.element";
import { panelElement } from "./structural/panel.element";

const BUILT_IN_ELEMENTS: ElementDescriptor[] = [
  noteElement,
  dbTableElement,
  jsonViewerElement,
  apiGroupElement,
  endpointElement,
  panelElement,
];

for (const element of BUILT_IN_ELEMENTS) {
  // Idempotent: vitest can evaluate this module more than once per worker.
  if (!hasElement(element.id)) registerElement(element);
}
