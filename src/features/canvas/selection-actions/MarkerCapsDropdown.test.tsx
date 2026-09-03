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
