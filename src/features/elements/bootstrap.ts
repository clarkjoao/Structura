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
import { externalElementElement } from "./structural/external-element.element";
import { panelElement } from "./structural/panel.element";
import { processNodeElement } from "./structural/process-node.element";
import { svgElement } from "./structural/svg.element";
import { unknownElement } from "./structural/unknown.element";
import { gcpElements } from "./families/gcp/gcp.family";
import { azureElements } from "./families/azure/azure.family";
import { awsElements } from "./families/aws/aws.family";

const BUILT_IN_ELEMENTS: ElementDescriptor[] = [
  noteElement,
  dbTableElement,
  jsonViewerElement,
  apiGroupElement,
  endpointElement,
  panelElement,
  processNodeElement,
  externalElementElement,
  svgElement,
  unknownElement,
  ...gcpElements,
  ...azureElements,
  ...awsElements,
];

for (const element of BUILT_IN_ELEMENTS) {
  // Idempotent: vitest can evaluate this module more than once per worker.
  if (!hasElement(element.id)) registerElement(element);
}
