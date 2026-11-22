import { COMPONENT_TYPE_PROCESS_NODE } from "@/features/diagram/model/component-type-constants";
import type { KindInspector, KindInspectorSection } from "../kind.types";
import {
  guidedChangeShape,
  guidedMoveStepToLane,
  guidedMoveStepToNewLane,
  guidedSetExperience,
  guidedSetPhaseStart,
} from "./guided.edits";
import { guidedPhases, phaseStartOf } from "./guided.phases";
import { GUIDED_STEP_SHAPES, experienceOf, isGuidedDecision, readGuided } from "./guided.model";

/**
 * The guided "Journey" tab (spec guided-editing-surfaces): the step's lane,
 * its kind, and — on a decision — its exits' labels. Lanes, notes and texts
 * have no tab: their actions sit on the canvas.
 */
export const guidedInspector: KindInspector = {
  tab: { key: "diagramKinds.guided.inspector.tab" },
  hiddenFields: ["technology", "type", "shape"],
  sections: (ctx, elementId) => {
    const reading = readGuided(ctx.diagram);
    const step = reading.steps.get(elementId);
    if (!step) return null;
    const laneId = reading.laneOf.get(elementId);
    const sections: KindInspectorSection[] = [
      {
        type: "choice",
        id: "lane",
        label: { key: "diagramKinds.guided.lanes.field" },
        options: [
          ...reading.lanes.map((lane) => ({
            id: lane.id,
            label: { text: lane.name },
            selected: lane.id === laneId,
            run: () => guidedMoveStepToLane(ctx.diagram, reading, elementId, lane.id),
          })),
          {
            id: "new-lane",
            label: { key: "diagramKinds.guided.inspector.newLane" },
            selected: false,
            creates: true,
            run: () =>
              guidedMoveStepToNewLane(
                ctx.diagram,
                elementId,
                ctx.t("diagramKinds.guided.lanes.newLane"),
              ),
          },
        ],
      },
      {
        type: "choice",
        id: "stepKind",
        label: { key: "diagramKinds.guided.inspector.stepKind" },
        options: GUIDED_STEP_SHAPES.map((shape) => ({
          id: shape,
          label: { key: `diagramKinds.guided.stepKinds.${shape}` },
          element: { type: COMPONENT_TYPE_PROCESS_NODE, flowShape: shape },
          selected: step.flowShape === shape,
          run: () => guidedChangeShape(ctx.diagram, elementId, shape),
        })),
      },
    ];
    // The phase it is in, and the phase it starts (spec guided-journey-phases).
    const { phases, phaseOf } = guidedPhases(reading);
    const inPhase = phaseOf.get(elementId);
    sections.push({
      type: "labels",
      id: "phase",
      label: { key: "diagramKinds.guided.phases.field" },
      items: [
        {
          id: "phase-start",
          title: { key: "diagramKinds.guided.phases.startHere" },
          label: phaseStartOf(step) ?? "",
          placeholder:
            inPhase !== undefined
              ? {
                  text: ctx.t("diagramKinds.guided.phases.inPhase", {
                    name: phases[inPhase]!.name,
                  }),
                }
              : { key: "diagramKinds.guided.phases.noPhase" },
          commit: (name) => guidedSetPhaseStart(ctx.diagram, elementId, name),
        },
      ],
    });
    const score = experienceOf(step);
    sections.push({
      type: "choice",
      id: "experience",
      label: { key: "diagramKinds.guided.experience.field" },
      options: [
        {
          id: "none",
          label: { text: "—" },
          selected: score === null,
          run: () => guidedSetExperience(ctx.diagram, elementId, null),
        },
        ...[1, 2, 3, 4, 5].map((value) => ({
          id: String(value),
          label: { text: String(value) },
          selected: score === value,
          run: () => guidedSetExperience(ctx.diagram, elementId, value),
        })),
      ],
    });
    if (isGuidedDecision(step)) {
      sections.push({
        type: "labels",
        id: "exits",
        label: { key: "diagramKinds.guided.inspector.exits" },
        empty: { key: "diagramKinds.guided.inspector.noExits" },
        items: (reading.outgoing.get(elementId) ?? []).map((exit) => ({
          id: exit.id,
          title: { key: "diagramKinds.guided.inspector.exitTo" },
          values: { name: reading.steps.get(exit.targetId)?.name ?? "" },
          placeholder: { key: "diagramKinds.guided.inspector.exitPlaceholder" },
          label: exit.label ?? "",
          commit: (label) => ({
            edit: { relabel: [{ id: exit.id, label: label.trim() }] },
            select: elementId,
          }),
        })),
      });
    }
    return sections;
  },
};
