import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider, type Node } from "@xyflow/react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import { useCanvasSelectionStore } from "@/features/canvas/hooks/useCanvasSelectionStore";
import { MultiSelectPanel } from "./MultiSelectPanel";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Multi", "container");
  store.openDiagram(diagram.id);
  const apps = [0, 1, 2].map((i) =>
    store.addComponent("container", `App${i}`, null, { x: i * 300, y: 0 }),
  );
  const sys = store.addComponent("system", "Sys", null, { x: 0, y: 300 });
  const note = store.addComponent("note", "Note", null, { x: 300, y: 300 });
  for (const c of [...apps, sys])
    store.updateNodeLayout(
      c.id,
      {
        x: c.id === sys.id ? 0 : apps.indexOf(c) * 300 + (apps.indexOf(c) === 1 ? 40 : 0),
        y: c.id === sys.id ? 300 : 0,
      },
      { width: 100, height: 50 },
    );
  const all = [...apps, sys, note];
  const nodes = all.map(
    (c) => ({ id: c.id, position: { x: 0, y: 0 }, data: { type: c.type } }) as Node,
  );
  return { ids: all.map((c) => c.id), apps, sys, note, nodes, diagramId: diagram.id };
}

const component = (diagramId: string, id: string) =>
  useDiagramStore.getState().diagrams[diagramId].snapshot.components[id];

function renderPanel(nodes: Node[]) {
  render(
    <ReactFlowProvider>
      <MultiSelectPanel selectedNodes={nodes} onClose={vi.fn()} />
    </ReactFlowProvider>,
  );
}

describe("MultiSelectPanel", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("names the selection and counts each type in the user's language", () => {
    const { nodes } = seed();
    renderPanel(nodes);
    expect(screen.getByText("5 elementos")).toBeTruthy();
    expect(screen.getByText("3 aplicações")).toBeTruthy();
    expect(screen.getByText("1 sistema")).toBeTruthy();
    expect(screen.getByText("1 nota")).toBeTruthy();
    // The old summary was English in pt-BR ("3 containers").
    expect(screen.queryByText(/containers/)).toBeNull();
  });

  it("uses the singular for one", async () => {
    await i18n.changeLanguage("en");
    const { nodes } = seed();
    renderPanel(nodes);
    expect(screen.getByText("1 system")).toBeTruthy();
    expect(screen.getByText("3 applications")).toBeTruthy();
  });

  it("clicking a type chip narrows the selection to that type", () => {
    const { nodes, apps } = seed();
    renderPanel(nodes);
    fireEvent.click(screen.getByText("3 aplicações"));
    // The canvas selection store is what the panel router reads.
    const selected = [...useCanvasSelectionStore.getState().selectedNodeIds];
    expect(selected.sort()).toEqual(apps.map((a) => a.id).sort());
  });

  it("offers Agrupar as the primary action; the rest are icon buttons", () => {
    const { nodes } = seed();
    renderPanel(nodes);
    expect(screen.getByRole("button", { name: "Agrupar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Duplicar" }).textContent).toBe("");
    // Save as template and delete moved under the ⋯ menu.
    expect(screen.queryByRole("button", { name: "Deletar" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Salvar como template/ })).toBeNull();
  });

  it("aligns in one gesture with one history checkpoint", () => {
    const { nodes, apps, diagramId } = seed();
    renderPanel(nodes);
    const before = useDiagramStore.getState().past.length;
    fireEvent.click(screen.getByRole("button", { name: "Alinhar ao topo" }));
    expect(useDiagramStore.getState().past.length).toBe(before + 1);
    const layouts = useDiagramStore.getState().diagrams[diagramId].nodeLayouts;
    expect(apps.every((a) => layouts[a.id].y === 0)).toBe(true);
  });

  it("shows 'Misto' where the selection disagrees, and writes a shared value to all", () => {
    const { nodes, apps, sys, diagramId } = seed();
    const store = useDiagramStore.getState();
    store.updateComponent(apps[0].id, { technology: "Go" } as never);
    store.updateComponent(apps[1].id, { technology: "Java" } as never);
    renderPanel(nodes.filter((n) => [...apps, sys].some((c) => c.id === n.id)));
    const technology = screen.getByLabelText("Tecnologia") as HTMLInputElement;
    expect(technology.placeholder).toBe("Misto");
    fireEvent.focus(technology);
    fireEvent.change(technology, { target: { value: "Rust" } });
    fireEvent.blur(technology);
    for (const c of [...apps, sys]) {
      expect((component(diagramId, c.id) as { technology?: string }).technology).toBe("Rust");
    }
  });

  it("adds a tag to every element without wiping the tags each already has", () => {
    const { nodes, apps, sys, diagramId } = seed();
    useDiagramStore.getState().updateComponent(apps[0].id, { tags: ["core"] });
    renderPanel(nodes.filter((n) => [...apps, sys].some((c) => c.id === n.id)));
    const input = screen.getByPlaceholderText(/Adicionar tag/);
    fireEvent.change(input, { target: { value: "pix" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(component(diagramId, apps[0].id).tags).toEqual(["core", "pix"]);
    expect(component(diagramId, apps[1].id).tags).toEqual(["pix"]);
    expect(component(diagramId, sys.id).tags).toEqual(["pix"]);
  });
});
