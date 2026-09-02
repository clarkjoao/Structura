import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow } from "@/features/diagram";
import { FlowInvite } from "./FlowInvite";

/**
 * The invite is what tells a reader the diagram has something to read. It names
 * the scripts rather than counting them, and it never opens one on its own —
 * the open script is what numbers the canvas, so before a choice there is none.
 */

const flow = (id: string, name: string): Flow => ({
  id,
  name,
  mermaid: "",
  diagramId: "d1",
  entryStepId: "s1",
  steps: { s1: { id: "s1", type: "action" } },
});

const CHECKOUT = flow("f1", "Checkout");
const REFUND = flow("f2", "Refund");
const CHARGEBACK = flow("f3", "Chargeback");

function renderInvite(flows: Flow[], onSelect = vi.fn()) {
  return { onSelect, ...render(<FlowInvite flows={flows} onSelect={onSelect} />) };
}

describe("the invite names what there is to read", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("names every script, rather than only counting them", () => {
    renderInvite([CHECKOUT, REFUND, CHARGEBACK]);

    for (const name of ["Checkout", "Refund", "Chargeback"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it("says how many there are, in words that match the count", () => {
    renderInvite([CHECKOUT, REFUND, CHARGEBACK]);

    expect(screen.getByTestId("viewer-flow-invite")).toHaveTextContent("This diagram has 3 flows:");
  });

  it("says it in the singular for exactly one, and still names it", () => {
    renderInvite([CHECKOUT]);

    const invite = screen.getByTestId("viewer-flow-invite");
    expect(invite).toHaveTextContent("This diagram has one flow:");
    expect(screen.getByRole("button", { name: /Checkout/ })).toBeInTheDocument();
  });

  it("hands back the script the reader picked", () => {
    const { onSelect } = renderInvite([CHECKOUT, REFUND]);

    fireEvent.click(screen.getByRole("button", { name: /Refund/ }));

    expect(onSelect).toHaveBeenCalledWith("f2");
  });

  it("opens nothing by itself", () => {
    const { onSelect } = renderInvite([CHECKOUT, REFUND]);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows nothing at all when the diagram has no script", () => {
    const { container } = renderInvite([]);

    expect(screen.queryByTestId("viewer-flow-invite")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("offers one button per script, and no more", () => {
    renderInvite([CHECKOUT, REFUND]);

    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("keeps the scripts in the order the diagram gives them, not in alphabetical order", () => {
    // Deliberately not alphabetical: sorted by name these would come back
    // Chargeback, Checkout, Refund.
    renderInvite([REFUND, CHARGEBACK, CHECKOUT]);

    expect(screen.getAllByRole("button").map((b) => b.textContent?.trim())).toEqual([
      "Refund",
      "Chargeback",
      "Checkout",
    ]);
  });

  it("names its own script in each button's hover text, not the first one's", () => {
    renderInvite([CHECKOUT, REFUND]);

    expect(screen.getByRole("button", { name: /Checkout/ })).toHaveAttribute(
      "title",
      "Read “Checkout”",
    );
    expect(screen.getByRole("button", { name: /Refund/ })).toHaveAttribute(
      "title",
      "Read “Refund”",
    );
  });
});
