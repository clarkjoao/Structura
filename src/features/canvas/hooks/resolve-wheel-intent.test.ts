import { describe, expect, it } from "vitest";
import {
  WHEEL_LINE_HEIGHT_PX,
  WHEEL_PINCH_DELTA_BOOST,
  WHEEL_ZOOM_PIXEL_SCALE,
} from "../canvas.constants";
import {
  resolveWheelIntent,
  zoomFactorFromWheel,
  type WheelIntentInput,
} from "./resolve-wheel-intent";

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

function expectedZoomFactor(deltaY: number, ctrlKey = false): number {
  const pinchBoost = ctrlKey ? WHEEL_PINCH_DELTA_BOOST : 1;
  return Math.pow(2, -deltaY * WHEEL_ZOOM_PIXEL_SCALE * pinchBoost);
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
  it("zooms in proportionally on a scroll up", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: -40 }), "zoom", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "zoom", factor: expectedZoomFactor(-40) });
  });

  it("zooms out proportionally on a scroll down", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 40 }), "zoom", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "zoom", factor: expectedZoomFactor(40) });
  });

  it("scales with |deltaY| so a trackpad tick is gentler than a mouse notch", () => {
    const trackpad = resolveWheelIntent(wheel({ deltaY: -3 }), "zoom", PANE_HEIGHT);
    const mouse = resolveWheelIntent(wheel({ deltaY: -120 }), "zoom", PANE_HEIGHT);

    expect(trackpad.kind).toBe("zoom");
    expect(mouse.kind).toBe("zoom");
    if (trackpad.kind !== "zoom" || mouse.kind !== "zoom") return;

    expect(trackpad.factor).toBeGreaterThan(1);
    expect(mouse.factor).toBeGreaterThan(trackpad.factor);
  });
});

describe("resolveWheelIntent — modifiers outrank the preference", () => {
  it("zooms on ctrl+wheel even in pan mode", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 4, ctrlKey: true }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "zoom", factor: expectedZoomFactor(4, true) });
  });

  it("zooms on meta+wheel even in pan mode", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: -4, metaKey: true }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "zoom", factor: expectedZoomFactor(-4) });
  });

  it("treats a trackpad pinch (ctrlKey synthesized by the browser) as zoom", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: -2.5, ctrlKey: true }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "zoom", factor: expectedZoomFactor(-2.5, true) });
  });

  it("pans horizontally on shift+wheel using deltaY", () => {
    const intent = resolveWheelIntent(wheel({ deltaY: 40, shiftKey: true }), "pan", PANE_HEIGHT);

    expect(intent).toEqual({ kind: "pan", dx: 40, dy: 0 });
  });

  it("pans horizontally on shift+wheel when the browser already remapped to deltaX", () => {
    // Chrome/Safari macOS: Shift+vertical scroll arrives as deltaX with deltaY === 0.
    const intent = resolveWheelIntent(
      wheel({ deltaX: 40, deltaY: 0, shiftKey: true }),
      "pan",
      PANE_HEIGHT,
    );

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

describe("zoomFactorFromWheel", () => {
  it("returns 1 when deltaY is 0", () => {
    expect(zoomFactorFromWheel(wheel({ deltaY: 0 }))).toBe(1);
  });

  it("boosts ctrlKey pinch deltas the way xyflow does", () => {
    const plain = zoomFactorFromWheel(wheel({ deltaY: -2.5 }));
    const pinch = zoomFactorFromWheel(wheel({ deltaY: -2.5, ctrlKey: true }));

    expect(pinch).toBeGreaterThan(plain);
  });
});
