import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Diagram, SceneDiff } from "@/features/diagram";
import { ShareModal } from "./ShareModal";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * A link opens on the base scene, whatever scene the author has open.
 *
 * That is deliberate (a link must not drop the reader inside a scene that hides
 * nodes, with no way out), but it was never said: an author with a scene open
 * sent a picture they were not looking at. The dialog now says it — always,
 * not only when the diagram has scenes, so the rule reads the same every time.
 * See docs/investigation/divergencia-edicao-visualizacao.md §3.4.
 */

const scene = { id: "sc1", name: "Without ledger" } as unknown as SceneDiff;

function diagram(withScene: boolean): Diagram {
  return {
    id: "d1",
    name: "Checkout",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: withScene ? { sc1: scene } : {},
    activeSceneId: withScene ? "sc1" : null,
  } as unknown as Diagram;
}

const open = (withScene: boolean) =>
  render(<ShareModal diagram={diagram(withScene)} open onOpenChange={() => {}} />);

describe("the share dialog says a link shows the base scene", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("says so while the author has a scene open", () => {
    open(true);
    expect(screen.getByRole("note")).toHaveTextContent(/always show the base scene/);
  });

  it("says so for a diagram with no scenes at all", () => {
    open(false);
    expect(screen.getByRole("note")).toHaveTextContent(/always show the base scene/);
  });

  it("says it in Portuguese too", async () => {
    await i18n.changeLanguage("pt-BR");
    open(true);
    expect(screen.getByRole("note")).toHaveTextContent(/sempre mostram a cena base/);
  });
});
