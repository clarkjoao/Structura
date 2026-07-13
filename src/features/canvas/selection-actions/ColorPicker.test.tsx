import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/canvas/panels/ElementPanel/components/colorPresets", () => ({
  VIBRANT_PRESETS: [
    { color: "#FF0000", nameKey: "color.red" },
    { color: "#00FF00", nameKey: "color.green" },
    { color: "#0000FF", nameKey: "color.blue" },
  ],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { ColorPicker } from "./ColorPicker";

describe("ColorPicker", () => {
  it("renders a button (no swatches visible until dropdown opens)", () => {
    const onSelectColor = vi.fn();
    render(<ColorPicker onSelectColor={onSelectColor} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(1);
  });

  it("opens dropdown with swatches on button click", () => {
    const onSelectColor = vi.fn();
    render(<ColorPicker onSelectColor={onSelectColor} />);
    fireEvent.click(screen.getByRole("button"));
    // After click, swatches should appear (now visible as buttons)
    const buttons = screen.getAllByRole("button");
    // 1 trigger button + 3 swatch buttons
    expect(buttons.length).toBeGreaterThan(1);
  });

  it("calls onSelectColor when a swatch is clicked", () => {
    const onSelectColor = vi.fn();
    render(<ColorPicker onSelectColor={onSelectColor} />);
    fireEvent.click(screen.getByRole("button"));
    // Get the swatch buttons (after the trigger)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onSelectColor).toHaveBeenCalledTimes(1);
  });

  it("shows reset button inside dropdown when onReset is provided", () => {
    const onSelectColor = vi.fn();
    const onReset = vi.fn();
    render(
      <ColorPicker
        selectedColor="#FF0000"
        onSelectColor={onSelectColor}
        onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    // Reset button now lives inside the dropdown, not the trigger
    const resetButtons = screen.getAllByTitle("colorSwatches.default");
    expect(resetButtons.length).toBeGreaterThan(0);
  });

  it("calls onReset when reset button is clicked", () => {
    const onSelectColor = vi.fn();
    const onReset = vi.fn();
    render(
      <ColorPicker
        selectedColor="#FF0000"
        onSelectColor={onSelectColor}
        onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    const resetButton = screen.getByTitle("colorSwatches.default");
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});