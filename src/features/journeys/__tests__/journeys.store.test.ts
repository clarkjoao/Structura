import { afterEach, describe, expect, it } from "vitest";
import type { Journey, JourneyStep } from "../types";
import { migrateJourneyStepsDiagramId, useJourneyStore } from "../store/journeys.store";

describe("journeys store", () => {
  afterEach(() => {
    useJourneyStore.setState({ journeys: {} });
  });

  it("addJourney creates journey with expected fields", () => {
    const journey = useJourneyStore.getState().addJourney("Alpha", "desc", "domain");
    expect(journey.name).toBe("Alpha");
    expect(journey.description).toBe("desc");
    expect(journey.domain).toBe("domain");
    expect(journey.tags).toEqual([]);
    expect(journey.steps).toEqual({});
    expect(typeof journey.id).toBe("string");
    expect(journey.createdAt).toBe(journey.updatedAt);
    expect(useJourneyStore.getState().journeys[journey.id]).toEqual(journey);
  });

  it("addJourneyStep assigns incrementing order", () => {
    const { id: journeyId } = useJourneyStore.getState().addJourney("J");
    const first = useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "A",
      diagramId: "d1",
    });
    const second = useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "B",
      diagramId: "d1",
    });
    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
  });

  it("addJourneyStep normalizes missing diagramId to empty string", () => {
    const { id: journeyId } = useJourneyStore.getState().addJourney("J");
    const step = useJourneyStore
      .getState()
      .addJourneyStep(journeyId, { label: "A" } as unknown as Omit<JourneyStep, "id" | "order">);
    expect(step.diagramId).toBe("");
  });

  it("reorderJourneySteps updates step order fields", () => {
    const { id: journeyId } = useJourneyStore.getState().addJourney("J");
    const a = useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "A",
      diagramId: "d",
    });
    const b = useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "B",
      diagramId: "d",
    });
    const c = useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "C",
      diagramId: "d",
    });
    useJourneyStore.getState().reorderJourneySteps(journeyId, [c.id, a.id, b.id]);
    const steps = useJourneyStore.getState().journeys[journeyId]!.steps;
    expect(steps[c.id]!.order).toBe(0);
    expect(steps[a.id]!.order).toBe(1);
    expect(steps[b.id]!.order).toBe(2);
  });

  it("removeJourneyStep removes step and reindexes order", () => {
    const { id: journeyId } = useJourneyStore.getState().addJourney("J");
    useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "A",
      diagramId: "d",
    });
    const b = useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "B",
      diagramId: "d",
    });
    useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "C",
      diagramId: "d",
    });
    useJourneyStore.getState().removeJourneyStep(journeyId, b.id);
    const steps = Object.values(useJourneyStore.getState().journeys[journeyId]!.steps);
    expect(steps).toHaveLength(2);
    const byLabel = Object.fromEntries(steps.map((step) => [step.label, step]));
    expect(byLabel.A?.order).toBe(0);
    expect(byLabel.C?.order).toBe(1);
    expect(byLabel.B).toBeUndefined();
  });

  it("updateJourneyStep updates one step without changing others", () => {
    const { id: journeyId } = useJourneyStore.getState().addJourney("J");
    const a = useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "A",
      diagramId: "d1",
    });
    const b = useJourneyStore.getState().addJourneyStep(journeyId, {
      label: "B",
      diagramId: "d2",
    });
    useJourneyStore.getState().updateJourneyStep(journeyId, a.id, {
      label: "A2",
      diagramId: "dx",
    });
    const journey = useJourneyStore.getState().journeys[journeyId]!;
    expect(journey.steps[a.id]!.label).toBe("A2");
    expect(journey.steps[a.id]!.diagramId).toBe("dx");
    expect(journey.steps[b.id]).toEqual(b);
  });

  it("removeJourney removes the journey", () => {
    const { id } = useJourneyStore.getState().addJourney("J");
    useJourneyStore.getState().removeJourney(id);
    expect(useJourneyStore.getState().journeys[id]).toBeUndefined();
  });

  it("migrateJourneyStepsDiagramId fills missing diagramId with empty string", () => {
    const legacy = {
      j1: {
        id: "j1",
        name: "J",
        tags: [],
        steps: {
          s1: { id: "s1", label: "a", order: 0 },
        },
        createdAt: 1,
        updatedAt: 1,
      },
    } as unknown as Record<string, Journey>;
    const migrated = migrateJourneyStepsDiagramId(legacy);
    expect(migrated.j1.steps.s1.diagramId).toBe("");
  });
});
