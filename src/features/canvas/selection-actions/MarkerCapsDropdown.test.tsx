import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mocks must be declared before imports
vi.mock("@/features/diagram", () => ({
  EdgeMarker: {
    None: "none",
    Arrow: "arrow",
    ArrowClosed: "arrowClosed",
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { MarkerCapsDropdown } from "./MarkerCapsDropdown";

describe("MarkerCapsDropdown", () => {
  it("renders the current cap label", () => {
    const onChangeCap = vi.fn();
    render(
      <MarkerCapsDropdown
        currentCap={"arrow" as any}
        onChangeCap={onChangeCap}
        capType="end"
      />,
    );
    expect(screen.getByText(/markerArrow/)).toBeInTheDocument();
  });

  it("opens dropdown on click", async () => {
    const onChangeCap = vi.fn();
    render(
      <MarkerCapsDropdown
        currentCap={"none" as any}
        onChangeCap={onChangeCap}
        capType="end"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText(/markerArrow/)).toBeInTheDocument();
    });
  });

  it("calls onChangeCap when an option is selected", async () => {
    const onChangeCap = vi.fn();
    render(
      <MarkerCapsDropdown
        currentCap={"none" as any}
        onChangeCap={onChangeCap}
        capType="end"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      fireEvent.click(screen.getByText(/markerArrow/));
    });
    expect(onChangeCap).toHaveBeenCalledWith("arrow");
  });
});
