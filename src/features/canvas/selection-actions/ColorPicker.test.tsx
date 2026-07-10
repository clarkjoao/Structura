import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mocks must be declared before imports
vi.mock("@/features/canvas/panels/ElementPanel/components/colorPresets", () => ({
  VIBRANT_PRESETS: [
    { color: "#FF0000", nameKey: "color.red" },
    { color: "#00FF00", nameKey: "color.green" },
    { color: "#0000FF", nameKey: "color.blue" },
    { color: "#FFFF00", nameKey: "color.yellow" },
    { color: "#FF00FF", nameKey: "color.magenta" },
    { color: "#00FFFF", nameKey: "color.cyan" },
    { color: "#FFA500", nameKey: "color.orange" },
    { color: "#800080", nameKey: "color.purple" },
  ],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { ColorPicker } from "./ColorPicker";

describe("ColorPicker", () => {
  it("renders color swatches", () => {
    const onSelectColor = vi.fn();
    render(<ColorPicker onSelectColor={onSelectColor} />);
    const swatches = screen.getAllByRole("button");
    expect(swatches.length).toBeGreaterThan(0);
  });

  it("calls onSelectColor when a swatch is clicked", () => {
    const onSelectColor = vi.fn();
    render(<ColorPicker onSelectColor={onSelectColor} />);
    const swatches = screen.getAllByRole("button");
    fireEvent.click(swatches[0]);
    expect(onSelectColor).toHaveBeenCalledTimes(1);
  });

  it("shows reset button when onReset is provided", () => {
    const onSelectColor = vi.fn();
    const onReset = vi.fn();
    render(
      <ColorPicker
        selectedColor="#FF0000"
        onSelectColor={onSelectColor}
        onReset={onReset}
      />,
    );
    const resetButtons = screen.getAllByTitle("colorSwatches.default");
    expect(resetButtons).toHaveLength(1);
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
    const resetButton = screen.getByTitle("colorSwatches.default");
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
