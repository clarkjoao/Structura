import type { Component } from "@/features/diagram/model/component.types";
import { COMPONENT_TYPE_PROCESS_NODE } from "@/features/diagram/model/component-type-constants";
import type { DiagramKindDescriptor, KindCommand } from "../kind.types";
import { arrangeGuided, guidedArrangeKey } from "./guided.arrange";
import { guidedChecks } from "./guided.checks";
import { guidedElementActions } from "./guided.elementActions";
import { guidedConforms } from "./guided.conforms";
import { deriveGuidedFlow, guidedFlowId } from "./guided.derive";
import {
  guidedAddBranch,
  guidedAddNext,
  guidedCreate,
  guidedDeleteStep,
  guidedInsertStep,
  guidedMoveToLane,
} from "./guided.edits";
import {
  GUIDED_KIND_ID,
  GUIDED_STEP_SHAPES,
  isGuidedAnnotation,
  isGuidedLane,
  readGuided,
} from "./guided.model";

const oneStepSelected: KindCommand["enabled"] = (ctx) =>
  ctx.selectedIds.length === 1 && readGuided(ctx.diagram).steps.has(ctx.selectedIds[0]!);

const commands: readonly KindCommand[] = [
  {
    id: "guided.next",
    label: { key: "diagramKinds.guided.commands.next" },
    keys: ["Tab"],
    contextMenu: true,
    enabled: oneStepSelected,
    run: (ctx) => guidedAddNext(ctx.diagram, ctx.selectedIds, ctx),
  },
  {
    id: "guided.branch",
    label: { key: "diagramKinds.guided.commands.branch" },
    keys: ["Shift+Tab"],
    contextMenu: true,
    enabled: oneStepSelected,
    run: (ctx) => guidedAddBranch(ctx.diagram, ctx.selectedIds, ctx),
  },
  {
    id: "guided.laneUp",
    label: { key: "diagramKinds.guided.commands.laneUp" },
    keys: ["Alt+ArrowUp", "Alt+ArrowLeft"],
    contextMenu: true,
    enabled: oneStepSelected,
    run: (ctx) => guidedMoveToLane(ctx.diagram, ctx.selectedIds, -1),
  },
  {
    id: "guided.laneDown",
    label: { key: "diagramKinds.guided.commands.laneDown" },
    keys: ["Alt+ArrowDown", "Alt+ArrowRight"],
    contextMenu: true,
    enabled: oneStepSelected,
    run: (ctx) => guidedMoveToLane(ctx.diagram, ctx.selectedIds, 1),
  },
  {
    id: "guided.delete",
    label: { key: "diagramKinds.guided.commands.delete" },
    keys: ["Delete", "Backspace"],
    enabled: oneStepSelected,
    run: (ctx) => guidedDeleteStep(ctx.diagram, ctx.selectedIds),
  },
];

/**
 * The guided kind (ADR-0014): a BPMN-inspired journey / data-flow map. Lanes
 * say who or what acts, steps are written in sequence from the keyboard, and
 * the picture is always the lane-banded arrangement of that sequence.
 */
export const guidedKind: DiagramKindDescriptor = {
  id: GUIDED_KIND_ID,
  label: { key: "diagramKinds.guided.label" },
  description: { key: "diagramKinds.guided.description" },
  returnLabel: { key: "diagramKinds.guided.return" },
  creatable: true,
  elements: GUIDED_STEP_SHAPES.map((flowShape) => ({
    type: COMPONENT_TYPE_PROCESS_NODE,
    flowShape,
  })),
  interaction: {
    nodesDraggable: false,
    resizable: false,
    arrangeModeChoice: false,
    recordFlows: false,
  },
  create: guidedCreate,
  conforms: guidedConforms,
  derive: deriveGuidedFlow,
  derivedFlowIds: (diagram) => {
    const id = guidedFlowId(diagram);
    return id ? [id] : [];
  },
  arrange: arrangeGuided,
  arrangeKey: guidedArrangeKey,
  checks: guidedChecks,
  commands,
  elementActions: guidedElementActions,
  insert: (ctx, element) =>
    guidedInsertStep(ctx.diagram, ctx.selectedIds, element.flowShape ?? "rectangle", ctx),
  isAnnotation: (component: Component) => isGuidedAnnotation(component) || isGuidedLane(component),
};
