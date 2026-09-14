import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isModKeyPressed,
  isOsTextEditingChord,
  shouldYieldCanvasShortcutToFocusedField,
} from "./helpers";

function macModEvent(
  key: string,
  target: EventTarget | null,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    metaKey: true,
    bubbles: true,
    ...init,
  });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

describe("isModKeyPressed", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true for ctrlKey=true on Windows platform", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      platform: "Win32",
    });
    const ev = new KeyboardEvent("keydown", { key: "a", ctrlKey: true, metaKey: false });
    expect(isModKeyPressed(ev)).toBe(true);
  });
});

describe("shouldYieldCanvasShortcutToFocusedField", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("does not yield when nothing is focused in a field", () => {
    const event = macModEvent("e", document.body);
    expect(shouldYieldCanvasShortcutToFocusedField(event)).toBe(false);
  });

  it("yields plain typing keys to a focused input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const event = new KeyboardEvent("keydown", { key: "a", bubbles: true });
    Object.defineProperty(event, "target", { value: input });
    expect(shouldYieldCanvasShortcutToFocusedField(event)).toBe(true);
  });

  it("yields Shift+E to a focused panel field (typing a capital E)", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      platform: "MacIntel",
    });
    const input = document.createElement("input");
    document.body.appendChild(input);
    const event = new KeyboardEvent("keydown", {
      key: "E",
      code: "KeyE",
      shiftKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, "target", { value: input });
    expect(shouldYieldCanvasShortcutToFocusedField(event)).toBe(true);
  });

  it("does not yield Cmd+F to a focused panel field (canvas tool chord)", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      platform: "MacIntel",
    });
    const input = document.createElement("input");
    document.body.appendChild(input);
    const event = macModEvent("f", input);
    expect(shouldYieldCanvasShortcutToFocusedField(event)).toBe(false);
  });

  it("yields Cmd+C to a focused field (OS text editing)", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      platform: "MacIntel",
    });
    const input = document.createElement("input");
    document.body.appendChild(input);
    const event = macModEvent("c", input);
    expect(shouldYieldCanvasShortcutToFocusedField(event)).toBe(true);
    expect(isOsTextEditingChord(event)).toBe(true);
  });
});
