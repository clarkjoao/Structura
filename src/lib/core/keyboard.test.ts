import { describe, expect, it } from "vitest";
import {
  KEY,
  keyIs,
  keyIsEnterOrSpace,
  keyIsOneOf,
  keyMatchesLetter,
  keyMatchesLetterOrCode,
} from "./keyboard";

function keyEv(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, ...init });
}

describe("keyMatchesLetter", () => {
  it("matches the same letter in upper or lower case", () => {
    expect(keyMatchesLetter(keyEv("e"), "e")).toBe(true);
    expect(keyMatchesLetter(keyEv("E"), "e")).toBe(true);
    expect(keyMatchesLetter(keyEv("E"), "E")).toBe(true);
  });

  it("returns false for a different letter", () => {
    expect(keyMatchesLetter(keyEv("e"), "f")).toBe(false);
  });

  it("returns false for non-letter keys", () => {
    expect(keyMatchesLetter(keyEv("Escape"), "e")).toBe(false);
  });

  it("returns false when letter argument is not a single character", () => {
    expect(keyMatchesLetter(keyEv("e"), "ee")).toBe(false);
  });
});

describe("keyMatchesLetterOrCode", () => {
  it("matches via key when the character is a Latin letter", () => {
    expect(keyMatchesLetterOrCode(keyEv("l"), "l", "KeyL")).toBe(true);
  });

  it("matches via code when Option remaps the character", () => {
    expect(keyMatchesLetterOrCode(keyEv("¬", { code: "KeyL" }), "l", "KeyL")).toBe(true);
  });

  it("returns false when neither key nor code matches", () => {
    expect(keyMatchesLetterOrCode(keyEv("¬", { code: "KeyK" }), "l", "KeyL")).toBe(false);
  });
});

describe("keyIs", () => {
  it("matches DOM key strings exactly", () => {
    expect(keyIs(keyEv("Enter"), KEY.ENTER)).toBe(true);
    expect(keyIs(keyEv("Escape"), KEY.ESCAPE)).toBe(true);
    expect(keyIs(keyEv("Enter"), KEY.ESCAPE)).toBe(false);
  });
});

describe("keyIsOneOf", () => {
  it("matches any listed key", () => {
    expect(keyIsOneOf(keyEv("Delete"), [KEY.DELETE, KEY.BACKSPACE])).toBe(true);
    expect(keyIsOneOf(keyEv("Backspace"), [KEY.DELETE, KEY.BACKSPACE])).toBe(true);
    expect(keyIsOneOf(keyEv("Enter"), [KEY.DELETE, KEY.BACKSPACE])).toBe(false);
  });
});

describe("keyIsEnterOrSpace", () => {
  it("matches Enter or Space only", () => {
    expect(keyIsEnterOrSpace(keyEv("Enter"))).toBe(true);
    expect(keyIsEnterOrSpace(keyEv(" "))).toBe(true);
    expect(keyIsEnterOrSpace(keyEv("Escape"))).toBe(false);
  });
});

describe("isEditableTarget — Monaco's EditContext", () => {
  it("treats the native edit context inside a Monaco editor as editable", async () => {
    const { isEditableTarget } = await import("./keyboard");
    const editor = document.createElement("div");
    editor.className = "monaco-editor";
    const inner = document.createElement("div");
    const target = document.createElement("div");
    target.className = "native-edit-context";
    inner.appendChild(target);
    editor.appendChild(inner);
    document.body.appendChild(editor);
    expect(isEditableTarget(target)).toBe(true);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    editor.remove();
  });
});
