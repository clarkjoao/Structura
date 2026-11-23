import { COMPONENT_TYPE_PROCESS_NODE } from "@/features/diagram/model/component-type-constants";
import type { KindInspector, KindInspectorSection } from "../kind.types";
import {
  guidedChangeShape,
  guidedMoveStepToLane,
  guidedMoveStepToNewLane,
  guidedSetParticipants,
  guidedSetPhaseStart,
} from "./guided.edits";
import { guidedPhaseNames, guidedPhases, phaseStartOf } from "./guided.phases";
import { GUIDED_STEP_SHAPES, isGuidedDecision, participantsOf, readGuided } from "./guided.model";

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
    // Picking a phase: continue it when the step already inherits it, else start it here.
    const { phases, phaseOf, inheritedOf } = guidedPhases(reading);
    const current = phases[phaseOf.get(elementId) ?? -1]?.name ?? null;
    const inherited = phases[inheritedOf.get(elementId) ?? -1]?.name ?? null;
    const pick = (name: string) =>
      guidedSetPhaseStart(ctx.diagram, elementId, name.trim() === inherited ? "" : name);
    const startsHere = phaseStartOf(step) !== null && current !== inherited;
    sections.push({
      type: "select",
      id: "phase",
      label: { key: "diagramKinds.guided.phases.field" },
      value: current,
      placeholder: { key: "diagramKinds.guided.phases.noPhase" },
      options: guidedPhaseNames(phases).map((name) => ({
        id: name,
        label: name,
        selected: name === current,
        run: () => pick(name),
      })),
      create: { label: { key: "diagramKinds.guided.phases.create" }, run: pick },
      ...(startsHere && {
        clear: {
          label:
            inherited !== null
              ? { key: "diagramKinds.guided.phases.continuePrevious" }
              : { key: "diagramKinds.guided.phases.remove" },
          run: () => guidedSetPhaseStart(ctx.diagram, elementId, ""),
        },
      }),
    });
    // Participants besides the lane's actor (spec guided-journey-blueprint).
    const laneName = reading.lanes.find((l) => l.id === laneId)?.name;
    const participants = participantsOf(step, laneName);
    sections.push({
      type: "tags",
      id: "participants",
      label: { key: "diagramKinds.guided.blueprint.participants" },
      values: participants,
      suggestions: reading.lanes.map((l) => l.name).filter((name) => name !== laneName),
      empty: { key: "diagramKinds.guided.blueprint.noParticipants" },
      placeholder: { key: "diagramKinds.guided.blueprint.participantsSearch" },
      addLabel: { key: "diagramKinds.guided.blueprint.addParticipant" },
      removeLabel: { key: "diagramKinds.guided.blueprint.removeParticipant" },
      add: (name) => guidedSetParticipants(ctx.diagram, elementId, [...participants, name]),
      remove: (name) =>
        guidedSetParticipants(
          ctx.diagram,
          elementId,
          participants.filter((p) => p !== name),
        ),
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
