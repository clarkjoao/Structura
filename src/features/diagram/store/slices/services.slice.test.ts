import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";
import { ExternalLinkType } from "../../enums";
import type { ServiceDefinition } from "../../model/service.types";

const makeLink = (name: string, url: string) => ({
  id: `link_${name}`,
  label: name,
  url,
  type: ExternalLinkType.Generic,
});

const baseService = (over: Partial<Omit<ServiceDefinition, "id">> = {}) => ({
  name: "Payments",
  description: "Takes the money",
  repositoryUrl: "",
  technology: ["Go", "gRPC"],
  tags: ["core"],
  ...over,
});

/**
 * `withTechnology`: a service copies its technology only onto a component that already carries
 * the field, so most tests start from one that does.
 */
function setup(withTechnology = true) {
  const store = createTestDiagramStore();
  store.setState((state) => {
    state.services = {};
  });
  const diagram = store.getState().addDiagram("D", "container");
  store.getState().openDiagram(diagram.id);
  const component = store.getState().addComponent("container", "Local name", null, { x: 0, y: 0 });
  if (withTechnology) store.getState().updateComponent(component.id, { technology: "" });
  const components = () => store.getState().diagrams[diagram.id].snapshot.components;
  return { store, diagramId: diagram.id, componentId: component.id, components };
}

describe("addService", () => {
  it("adds the service under a new id and returns it", () => {
    const { store } = setup();
    const svc = store.getState().addService(baseService());
    expect(svc.id).toMatch(/^svc/);
    expect(store.getState().services[svc.id]).toMatchObject({ name: "Payments" });
  });
});

describe("linkComponentToService", () => {
  it("copies the service's name, description, tags and technology onto the component", () => {
    const { store, componentId, components } = setup();
    const svc = store.getState().addService(baseService());
    store.getState().linkComponentToService(componentId, svc.id);
    expect(components()[componentId]).toMatchObject({
      serviceId: svc.id,
      name: "Payments",
      description: "Takes the money",
      tags: ["core"],
      technology: "Go, gRPC",
    });
  });

  it("merges the service's links into the component's, without repeating a url", () => {
    const { store, componentId, components } = setup();
    const link = makeLink("Runbook", "https://x/runbook");
    store.getState().updateComponent(componentId, { externalLinks: [link] });
    const svc = store.getState().addService(
      baseService({
        externalLinks: [link, makeLink("Repo", "https://x/repo")],
      }),
    );
    store.getState().linkComponentToService(componentId, svc.id);
    expect(components()[componentId].externalLinks?.map((l) => l.url)).toEqual([
      "https://x/runbook",
      "https://x/repo",
    ]);
  });

  it("clears what the previous service gave when switching to another one", () => {
    const { store, componentId, components } = setup();
    const a = store.getState().addService(baseService({ tags: ["a"], technology: ["Java"] }));
    const b = store
      .getState()
      .addService(baseService({ name: "Ledger", tags: undefined, technology: [] }));
    store.getState().linkComponentToService(componentId, a.id);
    store.getState().linkComponentToService(componentId, b.id);
    const comp = components()[componentId];
    expect(comp.serviceId).toBe(b.id);
    expect(comp.name).toBe("Ledger");
    expect(comp.tags).toBeUndefined();
    expect((comp as { technology?: string }).technology).toBeUndefined();
  });

  it("unlinking keeps the copied fields but drops the serviceId", () => {
    const { store, componentId, components } = setup();
    const svc = store.getState().addService(baseService());
    store.getState().linkComponentToService(componentId, svc.id);
    store.getState().linkComponentToService(componentId, undefined);
    expect(components()[componentId].serviceId).toBeUndefined();
    expect(components()[componentId].name).toBe("Payments");
  });

  it("links to a missing service without copying anything", () => {
    const { store, componentId, components } = setup();
    store.getState().linkComponentToService(componentId, "svc_missing");
    expect(components()[componentId]).toMatchObject({
      serviceId: "svc_missing",
      name: "Local name",
    });
  });

  it("is one undo step", () => {
    const { store, componentId, components } = setup();
    const svc = store.getState().addService(baseService());
    store.getState().linkComponentToService(componentId, svc.id);
    store.getState().undo();
    expect(components()[componentId].serviceId).toBeUndefined();
    expect(components()[componentId].name).toBe("Local name");
  });
});

describe("technology", () => {
  it("is copied only onto a component that already carries the field", () => {
    const { store, componentId, components } = setup(false);
    const svc = store.getState().addService(baseService());
    store.getState().linkComponentToService(componentId, svc.id);
    expect(components()[componentId].name).toBe("Payments");
    expect("technology" in components()[componentId]).toBe(false);
  });
});

describe("updateService", () => {
  it("pushes name, description, tags and technology edits to every linked component", () => {
    const { store, componentId, components } = setup();
    const svc = store.getState().addService(baseService());
    store.getState().linkComponentToService(componentId, svc.id);
    store.getState().updateService(svc.id, { name: "Billing", technology: ["Rust"] });
    expect(components()[componentId]).toMatchObject({ name: "Billing", technology: "Rust" });
  });

  it("reaches a component that only exists in a version scene", () => {
    const { store, diagramId, componentId } = setup();
    const svc = store.getState().addService(baseService());
    store.getState().linkComponentToService(componentId, svc.id);
    store.setState((state) => {
      const d = state.diagrams[diagramId];
      d.versions = {
        v1: {
          id: "v1",
          name: "V1",
          addedComponents: { scene_c: { ...d.snapshot.components[componentId], id: "scene_c" } },
          addedConnections: {},
          removedComponentIds: [],
        },
      } as unknown as typeof d.versions;
    });
    store.getState().updateService(svc.id, { name: "Billing" });
    const scene = store.getState().diagrams[diagramId].versions!.v1;
    expect(scene.addedComponents.scene_c.name).toBe("Billing");
  });

  it("leaves unlinked components alone", () => {
    const { store, componentId, components } = setup();
    const svc = store.getState().addService(baseService());
    store.getState().updateService(svc.id, { name: "Billing" });
    expect(components()[componentId].name).toBe("Local name");
  });

  it("a patch with none of the linked fields does not touch components", () => {
    const { store, componentId, components } = setup();
    const svc = store.getState().addService(baseService());
    store.getState().linkComponentToService(componentId, svc.id);
    store.getState().updateComponent(componentId, { name: "Edited locally" });
    store.getState().updateService(svc.id, { owner: "team-x" });
    expect(components()[componentId].name).toBe("Edited locally");
    expect(store.getState().services[svc.id].owner).toBe("team-x");
  });

  it("swaps links the old service had for the new service's, keeping the component's own", () => {
    const { store, componentId, components } = setup();
    const own = makeLink("Own", "https://x/own");
    const old = makeLink("Old", "https://x/old");
    const fresh = makeLink("New", "https://x/new");
    store.getState().updateComponent(componentId, { externalLinks: [own] });
    const svc = store.getState().addService(baseService({ externalLinks: [old] }));
    store.getState().linkComponentToService(componentId, svc.id);
    store.getState().updateService(svc.id, { externalLinks: [fresh] });
    const links = components()[componentId].externalLinks ?? [];
    const urls = links.map((l) => l.url).sort();
    expect(urls).toEqual(["https://x/new", "https://x/own"]);
  });

  it("drops the links entirely when none remain", () => {
    const { store, componentId, components } = setup();
    const old = makeLink("Old", "https://x/old");
    const svc = store.getState().addService(baseService({ externalLinks: [old] }));
    store.getState().linkComponentToService(componentId, svc.id);
    store.getState().updateService(svc.id, { externalLinks: [] });
    expect(components()[componentId].externalLinks).toBeUndefined();
  });

  it("ignores an unknown id", () => {
    const { store } = setup();
    expect(() => store.getState().updateService("svc_missing", { name: "x" })).not.toThrow();
  });
});

describe("removeService", () => {
  it("unlinks its components and keeps their copied fields", () => {
    const { store, componentId, components } = setup();
    const svc = store.getState().addService(baseService());
    store.getState().linkComponentToService(componentId, svc.id);
    store.getState().removeService(svc.id);
    expect(store.getState().services[svc.id]).toBeUndefined();
    expect(components()[componentId].serviceId).toBeUndefined();
    expect(components()[componentId].name).toBe("Payments");
  });

  // Characterization: history snapshots the diagrams, not the registry, so an undo puts the
  // link back on the component while the service stays deleted.
  it("undo restores the component's link but not the service itself", () => {
    const { store, componentId, components } = setup();
    const svc = store.getState().addService(baseService());
    store.getState().linkComponentToService(componentId, svc.id);
    store.getState().removeService(svc.id);
    store.getState().undo();
    expect(components()[componentId].serviceId).toBe(svc.id);
    expect(store.getState().services[svc.id]).toBeUndefined();
  });
});

describe("linkComponentToDiagram", () => {
  it("sets linkedDiagramId on an ordinary component and clears it with undefined", () => {
    const { store, componentId, components } = setup();
    store.getState().linkComponentToDiagram(componentId, "diag_x");
    expect(components()[componentId].linkedDiagramId).toBe("diag_x");
    store.getState().linkComponentToDiagram(componentId, undefined);
    expect(components()[componentId].linkedDiagramId).toBeUndefined();
  });

  it("writes referenceDiagramId on an external element instead", () => {
    const { store, diagramId } = setup();
    const ext = store.getState().addComponent("external-element", "Ext", null, { x: 0, y: 100 });
    store.getState().linkComponentToDiagram(ext.id, "diag_y");
    const comp = store.getState().diagrams[diagramId].snapshot.components[ext.id];
    expect((comp as { referenceDiagramId?: string }).referenceDiagramId).toBe("diag_y");
    expect(comp.linkedDiagramId).toBeUndefined();
    store.getState().linkComponentToDiagram(ext.id, undefined);
    const cleared = store.getState().diagrams[diagramId].snapshot.components[ext.id];
    expect((cleared as { referenceDiagramId?: string }).referenceDiagramId).toBe("");
  });

  it("ignores a component that does not exist", () => {
    const { store } = setup();
    expect(() => store.getState().linkComponentToDiagram("nope", "diag_x")).not.toThrow();
  });
});
