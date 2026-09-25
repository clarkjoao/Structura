// App-boot side effect (imported from main.tsx, like features/cloud/bootstrap):
// registering at module scope is what lets `sanitizeComponentType` and the
// store consult the registry during rehydrate, before any React tree exists.
import type { ElementDescriptor } from "./element.types";
import { registerElement, hasElement } from "./element.registry";
import { registerCloudFamily, isRegisteredCloudFamily } from "./families/cloud-family.registry";
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
import { gcpFamily } from "./families/gcp/gcp.family";
import { azureFamily } from "./families/azure/azure.family";
import { awsFamily } from "./families/aws/aws.family";
import { k8sFamily } from "./families/k8s/k8s.family";
import { ossFamily } from "./families/oss/oss.family";
import { c4Elements } from "./families/c4/c4.family";
import { vsmElements } from "./families/vsm/vsm.family";

const BUILT_IN_ELEMENTS: ElementDescriptor[] = [
  ...c4Elements,
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
  ...vsmElements,
];

for (const element of BUILT_IN_ELEMENTS) {
  // Idempotent: vitest can evaluate this module more than once per worker.
  if (!hasElement(element.id)) registerElement(element);
}

// Catalog families: one call each. Descriptors + cloudRegistry adapters land
// together — no per-family edit of cloud/bootstrap or ComponentType unions.
for (const family of [awsFamily, gcpFamily, azureFamily, k8sFamily, ossFamily]) {
  if (!isRegisteredCloudFamily(family.id)) registerCloudFamily(family);
}
