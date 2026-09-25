import type { ElementDescriptor } from "../../element.types";
import { vsmExternalElement } from "./vsm-external.element";

/**
 * Value Stream Mapping: the lean vocabulary, wearing the flow family's skin.
 *
 * Its own family (a real set of categories, like Kubernetes in decision 11)
 * rather than more flowchart shapes: each element carries its own data — a
 * process's metrics, an inventory's quantity, a timeline's segments.
 */
export const vsmElements: readonly ElementDescriptor[] = [vsmExternalElement];
