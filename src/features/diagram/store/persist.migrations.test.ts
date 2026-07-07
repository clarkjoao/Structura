import { describe, expect, it } from "vitest";
import { mergePersistedState } from "./persist.config";
import type { DiagramStore } from "./store.types";
import type { Component } from "../model/diagram.types";

/**
 * Schema migration tests for the five renames / unifications shipped
 * under feat/glossary:
 *
 *   v6 -> v7: ComponentType "processos" -> "process-node"
 *   v7 -> v8: state.serviceRegistry -> state.serviceCatalog
 *   v8 -> v9: walkthroughs store: localStorage key structura:journeys
 *             -> structura:walkthroughs (covered by the App.tsx
 *             migration module; not tested here)
 *   v9 -> v10: ExternalElementComponent.linkedDiagramId ->
 *              referenceDiagramId
 *   v10 -> v11: Component.registryServiceId -> serviceId
 *
 * Each test loads a v-shape fixture, runs `mergePersistedState`, and
 * asserts the post-migration shape. The migration is idempotent:
 * loading an already-migrated state is a no-op.
 */

function makeStateWithComponents(components: Record<string, Component>): Partial<DiagramStore> {
  return {
    diagrams: {
      d1: {
        snapshot: { components },
        scenes: {},
      } as never,
    },
  } as Partial<DiagramStore>;
}

function getComponent(state: Partial<DiagramStore>, id: string): Record<string, unknown> {
  return (
    state.diagrams as unknown as Record<
      string,
      { snapshot: { components: Record<string, Record<string, unknown>> } }
    >
  ).d1.snapshot.components[id];
}

describe("v6 -> v7: ComponentType processos -> process-node", () => {
  it("converts a flow-node type to process-node", () => {
    const state = makeStateWithComponents({
      c1: { type: "flow-node" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    expect(getComponent(next, "c1").type).toBe("process-node");
  });

  it("converts a processos type to process-node", () => {
    const state = makeStateWithComponents({
      c1: { type: "processos" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    expect(getComponent(next, "c1").type).toBe("process-node");
  });

  it("leaves other types untouched", () => {
    const state = makeStateWithComponents({
      c1: { type: "person" } as unknown as Component,
      c2: { type: "system" } as unknown as Component,
      c3: { type: "panel" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    expect(getComponent(next, "c1").type).toBe("person");
    expect(getComponent(next, "c2").type).toBe("system");
    expect(getComponent(next, "c3").type).toBe("panel");
  });

  it("is idempotent: process-node stays process-node", () => {
    const state = makeStateWithComponents({
      c1: { type: "process-node" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    expect(getComponent(next, "c1").type).toBe("process-node");
  });
});

describe("v7 -> v8: serviceRegistry -> serviceCatalog", () => {
  it("copies serviceRegistry to serviceCatalog and drops the legacy key", () => {
    const state = {
      diagrams: {},
      serviceRegistry: {
        "svc-a": { id: "svc-a", name: "A" },
        "svc-b": { id: "svc-b", name: "B" },
      },
    } as unknown as Partial<DiagramStore>;
    const next = mergePersistedState(state, {} as DiagramStore);
    const catalog = (next as unknown as { serviceCatalog: Record<string, { name: string }> })
      .serviceCatalog;
    expect(catalog["svc-a"]?.name).toBe("A");
    expect(catalog["svc-b"]?.name).toBe("B");
    expect((next as unknown as { serviceRegistry?: unknown }).serviceRegistry).toBeUndefined();
  });

  it("fixes the latent bug: when serviceRegistry is migrated, the legacy key must be dropped (not serviceCatalog)", () => {
    // This is a regression test for the v7 -> v8 migration that had
    // `delete record.serviceCatalog` instead of `delete record.serviceRegistry`.
    // Without the fix, the first save after the migration would have left
    // a stale `serviceRegistry` key. The migration is fixed in persist.config.ts;
    // this test guards against re-introducing the typo.
    const state = {
      diagrams: {},
      serviceRegistry: {
        "svc-a": { id: "svc-a", name: "A" },
      },
    } as unknown as Partial<DiagramStore>;
    const next = mergePersistedState(state, {} as DiagramStore);
    expect((next as unknown as { serviceRegistry?: unknown }).serviceRegistry).toBeUndefined();
  });

  it("is idempotent: serviceCatalog stays serviceCatalog", () => {
    const state = {
      diagrams: {},
      serviceCatalog: {
        "svc-a": { id: "svc-a", name: "A" },
      },
    } as unknown as Partial<DiagramStore>;
    const next = mergePersistedState(state, {} as DiagramStore);
    const catalog = (next as unknown as { serviceCatalog: Record<string, { name: string }> })
      .serviceCatalog;
    expect(catalog["svc-a"]?.name).toBe("A");
  });
});

describe("v9 -> v10: ExternalElementComponent.linkedDiagramId -> referenceDiagramId", () => {
  it("renames linkedDiagramId to referenceDiagramId on external elements", () => {
    const state = makeStateWithComponents({
      e1: { type: "external-element", linkedDiagramId: "diag-target" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    const e1 = getComponent(next, "e1");
    expect(e1.referenceDiagramId).toBe("diag-target");
    expect(e1.linkedDiagramId).toBeUndefined();
  });

  it("leaves BaseComponent.linkedDiagramId untouched (C4 drill-down)", () => {
    const state = makeStateWithComponents({
      c1: { type: "container", linkedDiagramId: "diag-drill-down" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    const c1 = getComponent(next, "c1");
    expect(c1.linkedDiagramId).toBe("diag-drill-down");
    expect(c1.referenceDiagramId).toBeUndefined();
  });

  it("is idempotent: referenceDiagramId stays referenceDiagramId", () => {
    const state = makeStateWithComponents({
      e1: { type: "external-element", referenceDiagramId: "diag-target" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    const e1 = getComponent(next, "e1");
    expect(e1.referenceDiagramId).toBe("diag-target");
    expect(e1.linkedDiagramId).toBeUndefined();
  });

  it("also migrates scene components", () => {
    const state = {
      diagrams: {
        d1: {
          snapshot: { components: {} },
          scenes: {
            s1: {
              addedComponents: {
                e1: {
                  type: "external-element",
                  linkedDiagramId: "diag-target",
                },
              },
            },
          },
        } as never,
      },
    } as Partial<DiagramStore>;
    const next = mergePersistedState(state, {} as DiagramStore);
    const e1 = (
      next.diagrams as unknown as Record<
        string,
        {
          scenes: Record<
            string,
            {
              addedComponents: Record<
                string,
                { referenceDiagramId?: string; linkedDiagramId?: string }
              >;
            }
          >;
        }
      >
    ).d1.scenes.s1.addedComponents.e1;
    expect(e1.referenceDiagramId).toBe("diag-target");
    expect(e1.linkedDiagramId).toBeUndefined();
  });
});

describe("v10 -> v11: Component.registryServiceId -> serviceId", () => {
  it("migrates a Component with only registryServiceId", () => {
    const state = makeStateWithComponents({
      c1: { type: "container", registryServiceId: "svc-a" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    const c1 = getComponent(next, "c1");
    expect(c1.serviceId).toBe("svc-a");
    expect(c1.registryServiceId).toBeUndefined();
  });

  it("leaves a Component with only serviceId untouched", () => {
    const state = makeStateWithComponents({
      c1: { type: "container", serviceId: "svc-a" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    const c1 = getComponent(next, "c1");
    expect(c1.serviceId).toBe("svc-a");
    expect(c1.registryServiceId).toBeUndefined();
  });

  it("drops the legacy field when both serviceId and registryServiceId are set; keeps serviceId", () => {
    const state = makeStateWithComponents({
      c1: {
        type: "container",
        serviceId: "svc-canonical",
        registryServiceId: "svc-legacy",
      } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    const c1 = getComponent(next, "c1");
    expect(c1.serviceId).toBe("svc-canonical");
    expect(c1.registryServiceId).toBeUndefined();
  });

  it("does nothing when neither field is set", () => {
    const state = makeStateWithComponents({
      c1: { type: "container" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    const c1 = getComponent(next, "c1");
    expect(c1.serviceId).toBeUndefined();
    expect(c1.registryServiceId).toBeUndefined();
  });

  it("is idempotent: registryServiceId absent on v11 state is a no-op", () => {
    const state = makeStateWithComponents({
      c1: { type: "container", serviceId: "svc-a" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    const c1 = getComponent(next, "c1");
    expect(c1.serviceId).toBe("svc-a");
    expect(c1.registryServiceId).toBeUndefined();
  });

  it("regression: components created via template instancing with registryServiceId are now linked to the service", () => {
    // Before the unification, a Component created via the custom-component
    // template instancing path was written with registryServiceId, but
    // linkComponentToService only read serviceId. The result was that
    // the link action silently missed the value and the user had to
    // re-link manually. After the unification, the legacy field is
    // migrated to serviceId, so the link action finds the value.
    const state = makeStateWithComponents({
      c1: { type: "container", registryServiceId: "svc-template" } as unknown as Component,
    });
    const next = mergePersistedState(state, {} as DiagramStore);
    const c1 = getComponent(next, "c1");
    // The serviceId field is now populated from the legacy value.
    expect(c1.serviceId).toBe("svc-template");
  });
});
