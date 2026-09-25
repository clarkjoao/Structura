import type { ElementDescriptor } from "../../element.types";
import { sfnStateElement } from "./sfn-state.element";
import { sfnStateMachineElement } from "./sfn-state-machine.element";

/**
 * AWS Step Functions: a state machine and its states, registered through
 * `registerElement` under its own family, so it gets a picker tab and an LLM
 * catalog heading from the registry alone.
 */
export const sfnElements: readonly ElementDescriptor[] = [
  sfnStateMachineElement,
  sfnStateElement,
];
