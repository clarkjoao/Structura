import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import type { Component } from "@/features/diagram";
import ComponentPanel from "./ComponentPanel";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/features/collaboration", () => ({ useCollab: () => ({ isGuest: false }) }));
vi.mock("@/features/collaboration/hooks/useElementLocks", () => ({
  useElementTextLock: () => ({ onFocus: () => undefined, onBlur: () => undefined, lockedBy: null }),
}));

/** The registry is the golden source of what a linked service lends an element. */
function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Svc", "container");
  store.openDiagram(diagram.id);
  const one = store.addComponent("container", "one", null, { x: 0, y: 0 });
  const two = store.addComponent("container", "two", null, { x: 300, y: 0 });
  store.updateComponent(one.id, { description: "mine", technology: "Rust", tags: ["x"] } as never);
  const service = store.addService({
    name: "cob-api",
    description: "Registered description",
    repositoryUrl: "",
    technology: ["Go", "gRPC"],
    tags: ["core"],
    sources: [],
  });
  const read = (id: string) =>
    useDiagramStore.getState().diagrams[diagram.id].snapshot.components[id] as Component & {
      technology?: string;
    };
  return { store, one, two, service, read };
}

function renderPanel(read: () => Component) {
  const { updateComponent, removeComponent } = useDiagramStore.getState();
  render(
    <MemoryRouter>
      <ReactFlowProvider>
        <ComponentPanel
          component={read()}
          onClose={vi.fn()}
          updateComponent={updateComponent}
          removeComponent={removeComponent}
        />
      </ReactFlowProvider>
    </MemoryRouter>,
  );
}

describe("a linked element and its service", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("linking pulls the service's name, description, technology and tags into the element", () => {
    const { store, one, service, read } = seed();
    store.linkComponentToService(one.id, service.id);
    expect(read(one.id)).toMatchObject({
      name: "cob-api",
      description: "Registered description",
      technology: "Go, gRPC",
      tags: ["core"],
      serviceId: service.id,
    });
  });

  it("says where the data comes from", () => {
    const { store, one, service, read } = seed();
    store.linkComponentToService(one.id, service.id);
    renderPanel(() => read(one.id));
    expect(screen.getByText(/come from the service “cob-api”/)).toBeTruthy();
  });

  it("editing a linked element's description edits the service and reaches every linked element", () => {
    const { store, one, two, service, read } = seed();
    store.linkComponentToService(one.id, service.id);
    store.linkComponentToService(two.id, service.id);
    renderPanel(() => read(one.id));
    const description = screen.getByDisplayValue("Registered description");
    fireEvent.focus(description);
    fireEvent.change(description, { target: { value: "Edited once" } });
    fireEvent.blur(description);
    expect(useDiagramStore.getState().services[service.id].description).toBe("Edited once");
    expect(read(one.id).description).toBe("Edited once");
    expect(read(two.id).description).toBe("Edited once");
  });

  it("renaming a linked element renames the service", () => {
    const { store, one, service, read } = seed();
    store.linkComponentToService(one.id, service.id);
    renderPanel(() => read(one.id));
    const name = screen.getByDisplayValue("cob-api");
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: "cob-api-v2" } });
    fireEvent.blur(name);
    expect(useDiagramStore.getState().services[service.id].name).toBe("cob-api-v2");
    expect(read(one.id).name).toBe("cob-api-v2");
  });

  it("an element with no service still edits only itself", () => {
    const { one, service, read } = seed();
    renderPanel(() => read(one.id));
    const description = screen.getByDisplayValue("mine");
    fireEvent.focus(description);
    fireEvent.change(description, { target: { value: "still mine" } });
    fireEvent.blur(description);
    expect(read(one.id).description).toBe("still mine");
    expect(useDiagramStore.getState().services[service.id].description).toBe(
      "Registered description",
    );
  });
});
