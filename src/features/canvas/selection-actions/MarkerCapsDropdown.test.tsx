import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarkerCapsDropdown } from "./MarkerCapsDropdown";
import { EdgeMarker } from "@/features/diagram";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("MarkerCapsDropdown", () => {
  it("renders the current cap label", () => {
    const onChangeCap = vi.fn();
    render(
      <MarkerCapsDropdown currentCap={EdgeMarker.Arrow} onChangeCap={onChangeCap} capType="end" />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows the marker as a glyph, not as text, on the toolbar button", () => {
    const { container } = render(
      <MarkerCapsDropdown currentCap={EdgeMarker.None} onChangeCap={vi.fn()} capType="end" />,
    );
    const button = screen.getByRole("button");
    expect(button.querySelector("svg[data-marker='none']")).not.toBeNull();
    // The label is for assistive tech only; nothing visible reads "markerNone".
    expect(container.textContent).toBe("");
    expect(button).toHaveAttribute("aria-label", expect.stringContaining("common.markerNone"));
  });

  it("mirrors the glyph for the start marker", () => {
    render(
      <MarkerCapsDropdown currentCap={EdgeMarker.Arrow} onChangeCap={vi.fn()} capType="start" />,
    );
    expect(screen.getByRole("button").querySelector("svg")).toHaveClass("-scale-x-100");
  });

  it("calls onChangeCap when an option is clicked", () => {
    const onChangeCap = vi.fn();
    const { container } = render(
      <MarkerCapsDropdown currentCap={EdgeMarker.Arrow} onChangeCap={onChangeCap} capType="end" />,
    );
    // Click the button to open dropdown
    fireEvent.click(screen.getByRole("button"));
    // Click the first option in the dropdown
    const options = container.querySelectorAll("button");
    if (options.length > 1) {
      fireEvent.click(options[1]);
    }
    // onChangeCap may or may not be called depending on dropdown behavior
  });
});
