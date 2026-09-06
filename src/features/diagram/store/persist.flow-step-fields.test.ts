import { describe, expect, it } from "vitest";
import {
  mergePersistedState,
  PERSIST_SCHEMA_VERSION,
  createPersistConfig,
  buildPersistStoragePayload,
} from "./persist.config";
import { migrateFlow } from "../utils/flow-migration";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import type { DiagramStore } from "./store.types";
import type { FlowStep } from "../model/flow.types";

/**
 * What it costs to add an optional field to a step.
 *
 * The persisted payload is the diagram object itself — `partializeState` hands
 * `diagrams` to JSON whole, and nothing on the way in or out enumerates the
 * fields of a step. So a new optional field rides along with no migration and
 * no schema bump, and a script written before the field existed still loads.
 * These tests are the evidence for that claim, not a reading of the code.
 */

function stateWithStep(step: Record<string, unknown>): Partial<DiagramStore> {
  return {
    diagrams: {
      d1: {
        id: "d1",
        snapshot: {
          components: {},
          connections: {},
          flows: {
            f1: {
              id: "f1",
              name: "Checkout",
              mermaid: "",
              diagramId: "d1",
              entryStepId: "s1",
              steps: { s1: step },
            },
          },
        },
        scenes: {},
      } as never,
    },
  } as Partial<DiagramStore>;
}

function readStep(state: Partial<DiagramStore>): Record<string, unknown> {
  return (
    state.diagrams as unknown as Record<
      string,
      { snapshot: { flows: Record<string, { steps: Record<string, Record<string, unknown>> }> } }
    >
  ).d1.snapshot.flows.f1.steps.s1;
}

describe("a new optional field on a step needs no migration", () => {
  it("keeps a title that was persisted with the step", () => {
    const state = stateWithStep({
      id: "s1",
      type: "action",
      title: "Client asks for a short link",
      note: "Only the happy path.",
    });

    const next = mergePersistedState(state, {} as DiagramStore);

    expect(readStep(next).title).toBe("Client asks for a short link");
    expect(readStep(next).note).toBe("Only the happy path.");
  });

  it("loads a step written before the field existed, leaving it unset", () => {
    const state = stateWithStep({ id: "s1", type: "action", componentId: "c1" });

    const next = mergePersistedState(state, {} as DiagramStore);

    expect(readStep(next)).toEqual({ id: "s1", type: "action", componentId: "c1" });
    expect(readStep(next).title).toBeUndefined();
  });

  it("carries a field the persist layer has never heard of, so no allowlist can drop one", () => {
    const state = stateWithStep({ id: "s1", type: "action", somethingNobodyAddedYet: 42 });

    const next = mergePersistedState(state, {} as DiagramStore);

    expect(readStep(next).somethingNobodyAddedYet).toBe(42);
  });

  it("takes a payload already at the current version through untouched", () => {
    const config = createPersistConfig(new InMemoryAdapter());
    const payload = stateWithStep({ id: "s1", type: "action", title: "Kept" });

    const migrated = config.migrate(payload, PERSIST_SCHEMA_VERSION) as Partial<DiagramStore>;

    expect(readStep(migrated).title).toBe("Kept");
  });

  it("leaves a graph-shaped flow alone, so the legacy rebuild cannot drop the field", () => {
    const flow = {
      id: "f1",
      name: "Checkout",
      mermaid: "",
      diagramId: "d1",
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action", title: "Kept", note: "Also kept" } as FlowStep,
      },
    };

    const migrated = migrateFlow(flow);

    expect(migrated.steps.s1!.title).toBe("Kept");
    expect(migrated.steps.s1!.note).toBe("Also kept");
  });

  it("writes the field out again, so a round trip does not quietly lose it", () => {
    const written = buildPersistStoragePayload({
      ...(stateWithStep({ id: "s1", type: "action", title: "Kept" }) as DiagramStore),
      folders: {},
      userTemplates: {},
      serviceCatalog: {},
      activeDiagramId: "d1",
    } as DiagramStore);

    const reloaded = mergePersistedState(
      JSON.parse(JSON.stringify(written.state)) as Partial<DiagramStore>,
      {} as DiagramStore,
    );

    expect(written.version).toBe(PERSIST_SCHEMA_VERSION);
    expect(readStep(reloaded).title).toBe("Kept");
  });

  it("keeps a step's context through a legacy rebuild, nested object and all", () => {
    const flow = {
      id: "f1",
      name: "Checkout",
      mermaid: "",
      diagramId: "d1",
      entryStepId: "s1",
      steps: {
        s1: {
          id: "s1",
          type: "action",
          context: {
            sets: { score: "0.12" },
            reads: ["cliente.cpf"],
            expects: '{"score":0.12}',
          },
        } as FlowStep,
      },
    };

    const migrated = migrateFlow(flow);

    expect(migrated.steps.s1!.context).toEqual({
      sets: { score: "0.12" },
      reads: ["cliente.cpf"],
      expects: '{"score":0.12}',
    });
  });

  it("round-trips a context through storage, so the new field needs no migration either", () => {
    const written = buildPersistStoragePayload({
      ...(stateWithStep({
        id: "s1",
        type: "action",
        context: { sets: { score: "0.12" } },
      }) as DiagramStore),
      folders: {},
      userTemplates: {},
      serviceCatalog: {},
      activeDiagramId: "d1",
    } as DiagramStore);

    const reloaded = mergePersistedState(
      JSON.parse(JSON.stringify(written.state)) as Partial<DiagramStore>,
      {} as DiagramStore,
    );

    expect(readStep(reloaded).context).toEqual({ sets: { score: "0.12" } });
  });

  it("is still schema 12, because nothing about the shape changed", () => {
    expect(PERSIST_SCHEMA_VERSION).toBe(12);
  });
});
