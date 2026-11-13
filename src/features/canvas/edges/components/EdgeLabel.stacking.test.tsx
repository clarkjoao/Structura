import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/features/elements/bootstrap";
import { allElements } from "@/features/elements/element.registry";
import { EdgeLabelPortalProvider, useEdgeLabelPortalContainer } from "../EdgeLabelPortal";
import { EDGE_LABEL_Z_INDEX, EdgeLabel } from "./EdgeLabel";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function Host() {
  const container = useEdgeLabelPortalContainer();
  return (
    <div data-testid="host" ref={(mount) => mount && container && mount.appendChild(container)} />
  );
}

/**
 * Audit D1: an edge label drawn over a card took the card's click, so a Shift-click
 * aimed at the card selected the edge and cleared the node selection. Labels sit
 * below cards; React Flow renders the label layer before the node layer, so an
 * equal `zIndex` already puts the card on top (checked in a real browser).
 */
describe("edge label stacking", () => {
  it("is not above any card-like element's default stacking", () => {
    const cardLevels = allElements()
      .map((element) => element.canvas?.zIndex)
      .filter((z): z is number => typeof z === "number" && z >= 1);
    expect(cardLevels.length).toBeGreaterThan(0);
    for (const z of cardLevels) expect(EDGE_LABEL_Z_INDEX).toBeLessThanOrEqual(z);
  });

  function renderLabel(canDrag: boolean) {
    return render(
      <EdgeLabelPortalProvider>
        <Host />
        <EdgeLabel
          labelPoint={{ x: 10, y: 20 }}
          label="calls"
          isHighlighted={false}
          dragPath={null}
          labelPosition={0.5}
          connectionId="c1"
          canDrag={canDrag}
          onDragStart={() => {}}
          onDragMove={() => {}}
          onDragEnd={() => {}}
        />
      </EdgeLabelPortalProvider>,
    );
  }

  it("renders the label with that stacking", () => {
    const { container } = renderLabel(false);
    const label = container.querySelector<HTMLElement>("[data-edge-label]");
    expect(label).not.toBeNull();
    expect(label!.style.zIndex).toBe(String(EDGE_LABEL_Z_INDEX));
    expect(label!.className).not.toMatch(/\bz-\[/);
    expect(label!.className).not.toContain("cursor-grab");
  });

  it("keeps the same stacking when the label can be dragged, with a grab cursor", () => {
    const { container } = renderLabel(true);
    const label = container.querySelector<HTMLElement>("[data-edge-label]");
    expect(label!.style.zIndex).toBe(String(EDGE_LABEL_Z_INDEX));
    expect(label!.className).toContain("cursor-grab");
  });
});
