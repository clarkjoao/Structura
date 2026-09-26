import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";

// No `vi.mock` for the presets or for react-i18next: the picker is reachable
// from the test setup's module graph (the flow inspector section uses it), so a
// factory mock arrives too late and silently does nothing — see
// `src/test/setup.tsx`. The assertions below hold for the real presets and the
// real translations.
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
    // 1 trigger button + the swatch buttons
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
    render(<ColorPicker selectedColor="#FF0000" onSelectColor={onSelectColor} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button"));
    // Reset button now lives inside the dropdown, not the trigger
    const resetButtons = screen.getAllByTitle(i18n.t("colorSwatches.default"));
    expect(resetButtons.length).toBeGreaterThan(0);
  });

  it("calls onReset when reset button is clicked", () => {
    const onSelectColor = vi.fn();
    const onReset = vi.fn();
    render(<ColorPicker selectedColor="#FF0000" onSelectColor={onSelectColor} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button"));
    const resetButton = screen.getByTitle(i18n.t("colorSwatches.default"));
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
