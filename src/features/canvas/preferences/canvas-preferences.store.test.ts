import { beforeEach, describe, expect, it } from "vitest";
import { CANVAS_PREFERENCES_KEY, useCanvasPreferencesStore } from "./canvas-preferences.store";

describe("inspector collapsed preference", () => {
  beforeEach(() => {
    localStorage.removeItem(CANVAS_PREFERENCES_KEY);
    useCanvasPreferencesStore.setState({ elementPanelCollapsed: false });
  });

  it("is open on first use", () => {
    expect(useCanvasPreferencesStore.getInitialState().elementPanelCollapsed).toBe(false);
  });

  it("is written to localStorage when the user collapses it", () => {
    useCanvasPreferencesStore.getState().setElementPanelCollapsed(true);
    const stored = JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY) ?? "{}") as {
      state?: { elementPanelCollapsed?: boolean };
    };
    expect(stored.state?.elementPanelCollapsed).toBe(true);
  });

  it("stays collapsed after a reload", async () => {
    useCanvasPreferencesStore.getState().setElementPanelCollapsed(true);
    // A reload starts from the defaults and reads localStorage back.
    useCanvasPreferencesStore.setState({ elementPanelCollapsed: false });
    localStorage.setItem(
      CANVAS_PREFERENCES_KEY,
      JSON.stringify({ state: { elementPanelCollapsed: true }, version: 0 }),
    );
    await useCanvasPreferencesStore.persist.rehydrate();
    expect(useCanvasPreferencesStore.getState().elementPanelCollapsed).toBe(true);
  });
});
