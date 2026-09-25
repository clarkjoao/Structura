import type { ElementDescriptor } from "../../../element.types";
import { k8sClusterElement, k8sNamespaceElement } from "./k8s-frames.element";

/**
 * Kubernetes structure, registered through `registerElement` under the
 * catalog family's id: the picker's Kubernetes tab and the LLM catalog's
 * Kubernetes block list them beside the service categories.
 */
export const k8sStructureElements: readonly ElementDescriptor[] = [
  k8sClusterElement,
  k8sNamespaceElement,
];
