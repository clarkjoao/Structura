import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrillDownButton } from "./DrillDownButton";

/**
 * The "explore inside" row is part of the card's box, and the box is what the
 * layout anchored the edges against. A reader has nowhere to go, so it keeps
 * the row and loses the action — dropping the row made the same card shorter
 * and narrower in the viewer than in the editor.
 */
describe("DrillDownButton", () => {
  it("is a button where there is somewhere to go", () => {
    render(<DrillDownButton elementId="c1" onDrillDown={vi.fn()} colorClass="" />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("keeps the row, without a control, where there is not", () => {
    const { container } = render(<DrillDownButton elementId="c1" colorClass="" />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.textContent).not.toBe("");
  });
});
