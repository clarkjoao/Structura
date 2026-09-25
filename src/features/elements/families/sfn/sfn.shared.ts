import { createElement } from "react";
import SkinnedElementPanel from "@/features/canvas/panels/ElementPanel/SkinnedElementPanel";
import type { ElementInspectorProps } from "../../element.types";

/**
 * AWS Step Functions, its own family (`aws-sfn`) apart from the AWS service
 * catalog: a state machine and its states, drawn with the flow skin. Ids are
 * `sfn-*`, never `aws-*`, which `isAwsType` would claim for the catalog.
 */
export const SFN_FAMILY_ID = "aws-sfn";
export const SFN_CATEGORY_ID = "aws-sfn";

/** Pink, the AWS integration token. */
export const SFN_ACCENT = "hsl(var(--aws-integration))";
/** A machine compact: header, chips and the drill-down "+". Derived, never stored. */
export const SFN_MACHINE_COMPACT_H = 84;

/** Every retry-bearing state's retry patch key. */
export const retryPatchKeys = ["retry"] as const;

export function SfnInspector(props: ElementInspectorProps) {
  return createElement(SkinnedElementPanel, props);
}
