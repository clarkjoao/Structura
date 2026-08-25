import { describe, expect, it } from "vitest";
import { WHEEL_LINE_HEIGHT_PX, WHEEL_ZOOM_FACTOR } from "../canvas.constants";
import { resolveWheelIntent, type WheelIntentInput } from "./resolve-wheel-intent";

const PANE_HEIGHT = 800;

function wheel(overrides: Partial<WheelIntentInput> = {}): WheelIntentInput {
  return {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe("resolveWheelIntent — pan mode (default)", () => {
  it("pans vertically on a plain vertical scroll", () => {
    // Regression: the old trackpad heuristic needed a non-zero deltaX to recognise a
    // trackpad, so this exact event — a two-finger vertical swipe — used to zoom.
    const intent = resolveWheelIntent(wheel({ deltaY: 40 }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "pan", dx: 0, dy: 40 });
  });

  it("pans both axes on a diagonal scroll", () => {
    const intent = resolveWheelIntent(wheel({ deltaX: -12, deltaY: 40 }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "pan", dx: -12, dy: 40 });
  });

  it("pans on a mouse wheel too", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 120 }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "pan", dx: 0, dy: 120 });
  });
});

describe("resolveWheelIntent — zoom mode", () => {
  it("zooms in on a scroll up", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: -40 }), "zoom", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "zoom", factor: WHEEL_ZOOM_FACTOR });
  });

  it("zooms out on a scroll down", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 40 }), "zoom", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "zoom", factor: 1 / WHEEL_ZOOM_FACTOR });
  });
});

describe("resolveWheelIntent — modifiers outrank the preference", () => {
  it("zooms on ctrl+wheel even in pan mode", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 4, ctrlKey: true }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "zoom", factor: 1 / WHEEL_ZOOM_FACTOR });
  });

  it("zooms on meta+wheel even in pan mode", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: -4, metaKey: true }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "zoom", factor: WHEEL_ZOOM_FACTOR });
  });

  it("treats a trackpad pinch (ctrlKey synthesized by the browser) as zoom", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: -2.5, ctrlKey: true }), "pan", PANE_HEIGHT);

    expect(intent.kind).toBe("zoom");
  });

  it("pans horizontally on shift+wheel", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 40, shiftKey: true }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "pan", dx: 40, dy: 0 });
  });

  it("still pans horizontally on shift+wheel in zoom mode", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 40, shiftKey: true }), "zoom", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "pan", dx: 40, dy: 0 });
  });

  it("lets ctrl win over shift", () => {
    const intent = resolveWheelIntent(
      wheel({ deltaY: 40, shiftKey: true, ctrlKey: true }),
      "pan",
      PANE_HEIGHT,
    );

    expect(intent.kind).toBe("zoom");
  });
});

describe("resolveWheelIntent — delta mode normalization", () => {
  it("scales line deltas to pixels", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 3, deltaMode: 1 }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "pan", dx: 0, dy: 3 * WHEEL_LINE_HEIGHT_PX });
  });

  it("scales page deltas by the pane height", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 1, deltaMode: 2 }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "pan", dx: 0, dy: PANE_HEIGHT });
  });

  it("leaves pixel deltas alone", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 120, deltaMode: 0 }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "pan", dx: 0, dy: 120 });
  });
});
