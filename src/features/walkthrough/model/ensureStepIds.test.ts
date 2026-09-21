import { describe, expect, it } from "vitest";
import type { WalkthroughPresentation, WalkthroughStepRef } from "./walkthrough.types";
import { ensureStepIds, ensureStepIdsIn, newStepId } from "./ensureStepIds";

function presentation(steps: Partial<WalkthroughStepRef>[]): WalkthroughPresentation {
  return {
    id: "wt_1",
    title: "Tour",
    createdAt: 0,
    updatedAt: 0,
    folderId: null,
    steps: steps as WalkthroughStepRef[],
  };
}

describe("ensureStepIds", () => {
  it("gives an id to a scene recorded before they had one", () => {
    const migrated = ensureStepIds(presentation([{ diagramId: "d-1", flowId: "f-1" }]));

    expect(migrated.steps[0].id).toBeTruthy();
  });

  it("gives every scene a different one", () => {
    const migrated = ensureStepIds(
      presentation([
        { diagramId: "d-1", flowId: "f-1" },
        { diagramId: "d-1", flowId: "f-1" },
        { diagramId: "d-1", flowId: "f-1" },
      ]),
    );

    expect(new Set(migrated.steps.map((s) => s.id)).size).toBe(3);
  });

  it("leaves ids that are already there alone", () => {
    const migrated = ensureStepIds(presentation([{ id: "kept", diagramId: "d-1", flowId: "f-1" }]));

    expect(migrated.steps[0].id).toBe("kept");
  });

  it("reissues a duplicate, which is what a copied scene carries", () => {
    const migrated = ensureStepIds(
      presentation([
        { id: "same", diagramId: "d-1", flowId: "f-1" },
        { id: "same", diagramId: "d-1", flowId: "f-2" },
      ]),
    );

    expect(migrated.steps[0].id).toBe("same");
    expect(migrated.steps[1].id).not.toBe("same");
  });

  it("returns the same object when nothing needed migrating", () => {
    const already = presentation([{ id: "a", diagramId: "d-1", flowId: "f-1" }]);

    // Hydrating an up-to-date library must not churn the store.
    expect(ensureStepIds(already)).toBe(already);
  });

  it("keeps everything else about the scene", () => {
    const migrated = ensureStepIds(
      presentation([{ diagramId: "d-1", flowId: "f-1", label: "Um", note: "nota" }]),
    );

    expect(migrated.steps[0]).toMatchObject({
      diagramId: "d-1",
      flowId: "f-1",
      label: "Um",
      note: "nota",
    });
  });
});

describe("ensureStepIdsIn", () => {
  it("migrates every walkthrough in the library", () => {
    const migrated = ensureStepIdsIn({
      a: presentation([{ diagramId: "d-1", flowId: "f-1" }]),
      b: presentation([{ diagramId: "d-2", flowId: "f-2" }]),
    });

    expect(migrated.a.steps[0].id).toBeTruthy();
    expect(migrated.b.steps[0].id).toBeTruthy();
  });

  it("returns the same record when none needed it", () => {
    const already = { a: presentation([{ id: "a", diagramId: "d-1", flowId: "f-1" }]) };

    expect(ensureStepIdsIn(already)).toBe(already);
  });
});

describe("newStepId", () => {
  it("does not repeat itself", () => {
    const ids = new Set(Array.from({ length: 200 }, newStepId));

    expect(ids.size).toBe(200);
  });
});
