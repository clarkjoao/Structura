import type { Component } from "@/features/diagram/model/component.types";
import { COMPONENT_TYPE_PROCESS_NODE } from "@/features/diagram/model/component-type-constants";
import type { DiagramKindDescriptor, KindCommand } from "../kind.types";
import { arrangeGuided, guidedArrangeKey } from "./guided.arrange";
import { guidedChecks } from "./guided.checks";
import { guidedElementActions } from "./guided.elementActions";
import { guidedConforms } from "./guided.conforms";
import { guidedTextCapture } from "./guided.outline";
import { guidedInspector } from "./guided.inspector";
import { guidedOverlay } from "./guided.overlay";
import { deriveGuidedFlow, guidedFlowId } from "./guided.derive";
import {
  guidedAddBranch,
  guidedAddNext,
  guidedCreate,
  guidedDeleteStep,
  guidedLabelExit,
  guidedInsertStep,
  guidedMoveToLane,
} from "./guided.edits";
import {
  GUIDED_KIND_ID,
  GUIDED_STEP_SHAPES,
  isGuidedAnnotation,
  isGuidedDecision,
  isGuidedLane,
  readGuided,
} from "./guided.model";

/** The step kinds the canvas toolbar offers as buttons; the rest sit under "More". */
const GUIDED_PRIMARY_SHAPES: ReadonlySet<string> = new Set(["rectangle", "diamond", "end"]);

const oneStepSelected: KindCommand["enabled"] = (ctx) =>
  ctx.selectedIds.length === 1 && readGuided(ctx.diagram).steps.has(ctx.selectedIds[0]!);

const onlyStepsSelected: KindCommand["enabled"] = (ctx) => {
  if (ctx.selectedIds.length === 0) return false;
  const { steps } = readGuided(ctx.diagram);
  return ctx.selectedIds.every((id) => steps.has(id));
};

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
    id: "guided.labelExit",
    label: { key: "diagramKinds.guided.commands.labelExit" },
    keys: ["Enter"],
    enabled: (ctx) => {
      if (ctx.selectedIds.length !== 1) return false;
      const reading = readGuided(ctx.diagram);
      const id = ctx.selectedIds[0]!;
      const step = reading.steps.get(id);
      if (step) return isGuidedDecision(step) && (reading.outgoing.get(id)?.length ?? 0) > 0;
      // An exit of a decision: its label was just written.
      for (const [sourceId, exits] of reading.outgoing) {
        if (!exits.some((c) => c.id === id)) continue;
        const source = reading.steps.get(sourceId);
        return source !== undefined && isGuidedDecision(source);
      }
      return false;
    },
    run: (ctx) => guidedLabelExit(ctx.diagram, ctx.selectedIds),
  },
  {
    id: "guided.delete",
    label: { key: "diagramKinds.guided.commands.delete" },
    keys: ["Delete", "Backspace"],
    enabled: onlyStepsSelected,
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
    label: { key: `diagramKinds.guided.stepKinds.${flowShape}` },
    ...(GUIDED_PRIMARY_SHAPES.has(flowShape) && { primary: true }),
  })),
  interaction: {
    nodesDraggable: false,
    resizable: false,
    arrangeModeChoice: false,
    recordFlows: false,
    // A step is where it is in the sequence: a copy of it elsewhere would read as another step.
    references: false,
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
  textCapture: guidedTextCapture,
  inspector: guidedInspector,
  overlay: guidedOverlay,
  insert: (ctx, element) =>
    guidedInsertStep(ctx.diagram, ctx.selectedIds, element.flowShape ?? "rectangle", ctx),
  isAnnotation: (component: Component) => isGuidedAnnotation(component) || isGuidedLane(component),
};
