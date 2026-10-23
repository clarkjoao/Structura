import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  ARRANGE_SLIDER_DEBOUNCE_MS,
  ArrangeControl,
  type ArrangeControlProps,
} from "./ArrangeControl";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function setup(overrides: Partial<ArrangeControlProps> = {}) {
  const props: ArrangeControlProps = {
    settings: undefined,
    labelled: false,
    running: false,
    onArrange: vi.fn(),
    onSettingsChange: vi.fn(),
    buttonClassName: "",
    ...overrides,
  };
  const view = render(<ArrangeControl {...props} />);
  return { props, ...view };
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "canvasToolbar.arrange.optionsAria" }));
}

describe("ArrangeControl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("arranges with the stored settings from the main button", () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "canvasToolbar.arrange.withShortcut" }));
    expect(props.onArrange).toHaveBeenCalledTimes(1);
    expect(props.onSettingsChange).not.toHaveBeenCalled();
  });

  it("disables the main button while a run is in flight", () => {
    setup({ running: true });
    expect(
      screen.getByRole("button", { name: "canvasToolbar.arrange.withShortcut" }),
    ).toBeDisabled();
  });

  it("shows the stored density and reserves the automatic mode", () => {
    setup({ settings: { density: "spacious" } });
    openMenu();

    expect(
      screen.getByRole("radio", { name: "canvasToolbar.arrange.densitySpacious" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /canvasToolbar.arrange.modeManual/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("radio", { name: /canvasToolbar.arrange.modeAutomatic/ }),
    ).toBeDisabled();
  });

  it("re-arranges with the picked density at once", () => {
    const { props } = setup();
    openMenu();

    fireEvent.click(screen.getByRole("radio", { name: "canvasToolbar.arrange.densityCompact" }));

    expect(props.onSettingsChange).toHaveBeenCalledWith({ density: "compact" });
    // The menu shows the request while it runs, instead of bouncing back.
    expect(
      screen.getByRole("radio", { name: "canvasToolbar.arrange.densityCompact" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("queues a change made during a run and sends only the last one when it ends", () => {
    const { props, rerender } = setup({ running: true });
    openMenu();

    fireEvent.click(screen.getByRole("radio", { name: "canvasToolbar.arrange.densityCompact" }));
    fireEvent.click(screen.getByRole("radio", { name: "canvasToolbar.arrange.densitySpacious" }));
    expect(props.onSettingsChange).not.toHaveBeenCalled();

    rerender(<ArrangeControl {...props} running={false} />);

    expect(props.onSettingsChange).toHaveBeenCalledTimes(1);
    expect(props.onSettingsChange).toHaveBeenCalledWith({ density: "spacious" });
  });

  it("debounces a gap slider into one run with the override", () => {
    vi.useFakeTimers();
    const { props } = setup({ settings: { density: "compact" } });
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "canvasToolbar.arrange.advanced" }));

    const slider = screen.getByLabelText(/canvasToolbar.arrange.layerGap/);
    fireEvent.change(slider, { target: { value: "250" } });
    fireEvent.change(slider, { target: { value: "300" } });
    expect(props.onSettingsChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(ARRANGE_SLIDER_DEBOUNCE_MS);
    });

    expect(props.onSettingsChange).toHaveBeenCalledTimes(1);
    expect(props.onSettingsChange).toHaveBeenCalledWith({ density: "compact", layerGap: 300 });
  });

  it("resets the gaps back to the density", () => {
    const { props } = setup({ settings: { density: "spacious", layerGap: 300, nodeGap: 90 } });
    openMenu();

    fireEvent.click(screen.getByRole("button", { name: "canvasToolbar.arrange.resetGaps" }));

    expect(props.onSettingsChange).toHaveBeenCalledWith({ density: "spacious" });
  });

  it("restores the defaults in one step, and is off when already default", () => {
    const { props, unmount } = setup({ settings: { density: "compact", layerGap: 300 } });
    openMenu();

    fireEvent.click(screen.getByRole("button", { name: /canvasToolbar.arrange.resetDefaults/ }));
    expect(props.onSettingsChange).toHaveBeenCalledWith({});
    unmount();

    setup();
    openMenu();
    expect(
      screen.getByRole("button", { name: /canvasToolbar.arrange.resetDefaults/ }),
    ).toBeDisabled();
  });
});
