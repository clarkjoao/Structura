import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Diagram, Flow } from "@/features/diagram";
import { ShareModal } from "./ShareModal";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * Naming the script a link opens on.
 *
 * The author had to send the link and then say, somewhere else, *click the one
 * along the bottom*.
 */
const flow = (id: string, name: string): Flow => ({
  id,
  name,
  mermaid: "",
  diagramId: "d1",
  entryStepId: "s1",
  steps: { s1: { id: "s1", type: "action" } },
});

function diagram(flows: Flow[]): Diagram {
  return {
    id: "d1",
    name: "Checkout",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {},
      connections: {},
      flows: Object.fromEntries(flows.map((f) => [f.id, f])),
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: {},
    activeSceneId: null,
  } as unknown as Diagram;
}

const open = (flows: Flow[]) =>
  render(<ShareModal diagram={diagram(flows)} open onOpenChange={() => {}} />);

const shareLink = () => (screen.getAllByRole("textbox")[0] as HTMLInputElement).value;
const flowOf = (url: string) => new URLSearchParams(url.split("#")[1]).get("flow");

describe("the share dialog names a script", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("offers the diagram's scripts, and none", () => {
    open([flow("f1", "Checkout"), flow("f2", "Refund")]);

    const select = screen.getByTestId("share-flow");

    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "no script" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Checkout" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Refund" })).toBeInTheDocument();
  });

  it("puts the chosen script in the link", () => {
    open([flow("f1", "Checkout"), flow("f2", "Refund")]);
    expect(flowOf(shareLink())).toBeNull();

    fireEvent.change(screen.getByTestId("share-flow"), { target: { value: "f2" } });

    expect(flowOf(shareLink())).toBe("f2");
  });

  it("takes it back out again", () => {
    open([flow("f1", "Checkout")]);
    fireEvent.change(screen.getByTestId("share-flow"), { target: { value: "f1" } });

    fireEvent.change(screen.getByTestId("share-flow"), { target: { value: "" } });

    expect(flowOf(shareLink())).toBeNull();
  });

  it("does not ask when the diagram has no scripts", () => {
    open([]);

    expect(screen.queryByTestId("share-flow")).not.toBeInTheDocument();
  });
});
