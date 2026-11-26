// App-boot side effect (imported from main.tsx, like features/cloud/bootstrap):
// registering at module scope is what lets `sanitizeComponentType` and the
// store consult the registry during rehydrate, before any React tree exists.
import type { ElementDescriptor } from "./element.types";
import { registerElement, hasElement } from "./element.registry";
import { registerBuiltinPacks } from "./packs/builtin-packs";
import { apiGroupElement } from "./structural/api-group.element";
import { dbTableElement } from "./structural/db-table.element";
import { endpointElement } from "./structural/endpoint.element";
import { jsonViewerElement } from "./structural/json-viewer.element";
import { noteElement } from "./structural/note.element";
import { externalElementElement } from "./structural/external-element.element";
import { panelElement } from "./structural/panel.element";
import { processNodeElement } from "./structural/process-node.element";
import { flowDividerElement } from "./structural/flow-divider.element";
import { textElement } from "./structural/text.element";
import { svgElement } from "./structural/svg.element";
import { unknownElement } from "./structural/unknown.element";
import { sharedRefElement } from "./structural/shared-ref.element";
import { c4Elements } from "./families/c4/c4.family";
import { deployElements } from "./families/deploy/deploy.family";
import { k8sStructureElements } from "./families/k8s/structure/k8s-structure.elements";

const BUILT_IN_ELEMENTS: ElementDescriptor[] = [
  ...c4Elements,
  noteElement,
  dbTableElement,
  jsonViewerElement,
  apiGroupElement,
  endpointElement,
  panelElement,
  processNodeElement,
  flowDividerElement,
  textElement,
  externalElementElement,
  svgElement,
  unknownElement,
  sharedRefElement,
  ...deployElements,
  ...k8sStructureElements,
];

for (const element of BUILT_IN_ELEMENTS) {
  // Idempotent: vitest can evaluate this module more than once per worker.
  if (!hasElement(element.id)) registerElement(element);
}

// Element packs (`packs/<id>/pack.json`): the AWS, GCP, Azure, Kubernetes and OSS catalogs,
// and every other pack found on disk. Descriptors, strings, accents and cloudRegistry
// adapters land together — adding a pack edits nothing here.
registerBuiltinPacks();
