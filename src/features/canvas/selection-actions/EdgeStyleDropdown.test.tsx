import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mocks must be declared before imports
vi.mock("@/features/diagram", () => ({
  EdgeStyle: {
    Straight: "straight",
    Bezier: "bezier",
    Step: "step",
    Smoothstep: "smoothstep",
    Editable: "editable",
    EditableStep: "editableStep",
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { EdgeStyleDropdown } from "./EdgeStyleDropdown";

describe("EdgeStyleDropdown", () => {
  it("renders a button", () => {
    const onChangeStyle = vi.fn();
    render(<EdgeStyleDropdown onChangeStyle={onChangeStyle} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("opens dropdown on click", async () => {
    const onChangeStyle = vi.fn();
    render(<EdgeStyleDropdown onChangeStyle={onChangeStyle} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText(/common.edgeStraight/)).toBeInTheDocument();
    });
  });

  it("calls onChangeStyle when an option is selected", async () => {
    const onChangeStyle = vi.fn();
    render(<EdgeStyleDropdown onChangeStyle={onChangeStyle} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      const options = screen.getAllByText(/common.edge/);
      fireEvent.click(options[0]);
    });
    expect(onChangeStyle).toHaveBeenCalledTimes(1);
  });
});
