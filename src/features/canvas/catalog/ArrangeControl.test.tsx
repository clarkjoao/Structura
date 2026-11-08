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
    onSettingsSave: vi.fn(),
    direction: "LR",
    onDirectionChange: vi.fn(),
    directionLockedReasonKey: null,
    arrangeLockedReasonKey: null,
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

  it("shows the stored density and mode", () => {
    setup({ settings: { density: "spacious" } });
    openMenu();

    expect(
      screen.getByRole("radio", { name: "canvasToolbar.arrange.densitySpacious" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "canvasToolbar.arrange.modeManual" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("turns automatic on without moving anything", () => {
    const { props } = setup({ settings: { density: "compact" } });
    openMenu();

    fireEvent.click(screen.getByRole("radio", { name: "canvasToolbar.arrange.modeAutomatic" }));

    expect(props.onSettingsSave).toHaveBeenCalledWith({ density: "compact", mode: "automatic" });
    expect(props.onSettingsChange).not.toHaveBeenCalled();
  });

  it("turns automatic off without arranging", () => {
    const { props } = setup({ settings: { mode: "automatic", density: "compact" } });
    openMenu();

    fireEvent.click(screen.getByRole("radio", { name: "canvasToolbar.arrange.modeManual" }));

    expect(props.onSettingsSave).toHaveBeenCalledWith({ density: "compact", mode: "manual" });
    expect(props.onSettingsChange).not.toHaveBeenCalled();
  });

  it("marks the button while the diagram arranges itself", () => {
    const { unmount } = setup();
    expect(screen.queryByText("canvasToolbar.arrange.autoBadge")).toBeNull();
    unmount();

    setup({ settings: { mode: "automatic" } });
    expect(screen.getByText("canvasToolbar.arrange.autoBadge")).toBeInTheDocument();
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
    const { props, unmount } = setup({
      settings: { mode: "automatic", density: "compact", layerGap: 300 },
    });
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

  it("switches the reading direction from the menu", () => {
    const { props } = setup();
    openMenu();

    fireEvent.click(screen.getByRole("radio", { name: "canvasToolbar.arrange.directionVertical" }));

    expect(props.onDirectionChange).toHaveBeenCalledWith("TB");
  });

  it("locks the direction during a live session and says why", () => {
    const { props } = setup({
      direction: "TB",
      directionLockedReasonKey: "canvasToolbar.arrange.directionLockedSession",
    });
    openMenu();

    expect(
      screen.getByRole("radio", { name: "canvasToolbar.arrange.directionHorizontal" }),
    ).toBeDisabled();
    expect(screen.getByText("canvasToolbar.arrange.directionLockedSession")).toBeInTheDocument();
    expect(props.onDirectionChange).not.toHaveBeenCalled();
  });

  it("locks arranging, and every setting that would re-arrange, in a large live session", () => {
    const { props } = setup({
      settings: { density: "compact", layerGap: 300 },
      arrangeLockedReasonKey: "canvasToolbar.arrange.lockedLargeSession",
    });
    expect(
      screen.getByRole("button", { name: "canvasToolbar.arrange.lockedLargeSession" }),
    ).toBeDisabled();
    openMenu();

    expect(
      screen.getByRole("radio", { name: "canvasToolbar.arrange.densitySpacious" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /canvasToolbar.arrange.resetDefaults/ }),
    ).toBeDisabled();
    // The mode only says what happens next; it moves nothing, so it stays on.
    fireEvent.click(screen.getByRole("radio", { name: "canvasToolbar.arrange.modeAutomatic" }));
    expect(props.onSettingsSave).toHaveBeenCalled();
    expect(props.onSettingsChange).not.toHaveBeenCalled();
  });
  it("re-arranges with the picked reference mode and shows the rules only for rules", () => {
    const { props } = setup();
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "canvasToolbar.arrange.advanced" }));
    expect(screen.getByLabelText(/canvasToolbar.arrange.refNeighborColumns/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "canvasToolbar.arrange.referencesOff" }));
    expect(props.onSettingsChange).toHaveBeenCalledWith({ references: "off" });
    expect(screen.queryByLabelText(/canvasToolbar.arrange.refNeighborColumns/)).toBeNull();
  });

  it("opens the advanced section on a diagram whose references are not the default", () => {
    setup({ settings: { references: "auto" } });
    openMenu();
    expect(
      screen.getByRole("radio", { name: "canvasToolbar.arrange.referencesAuto" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("debounces the neighbour distance into one run, and turns forward references on", () => {
    vi.useFakeTimers();
    const { props } = setup();
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "canvasToolbar.arrange.advanced" }));

    const slider = screen.getByLabelText(/canvasToolbar.arrange.refNeighborColumns/);
    fireEvent.change(slider, { target: { value: "3" } });
    fireEvent.change(slider, { target: { value: "4" } });
    act(() => {
      vi.advanceTimersByTime(ARRANGE_SLIDER_DEBOUNCE_MS);
    });
    expect(props.onSettingsChange).toHaveBeenCalledTimes(1);
    expect(props.onSettingsChange).toHaveBeenCalledWith({ refNeighborColumns: 4 });

    fireEvent.click(screen.getByLabelText(/canvasToolbar.arrange.refForward/));
    expect(props.onSettingsChange).toHaveBeenLastCalledWith({
      refNeighborColumns: 4,
      refForward: true,
    });
  });

  it("resets only the gaps, keeping the mode and the references", () => {
    const { props } = setup({
      settings: { mode: "automatic", references: "off", density: "compact", layerGap: 300 },
    });
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "canvasToolbar.arrange.resetGaps" }));
    expect(props.onSettingsChange).toHaveBeenCalledWith({
      mode: "automatic",
      references: "off",
      density: "compact",
    });
  });
});
