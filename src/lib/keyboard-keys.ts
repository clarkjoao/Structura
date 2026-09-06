/**
 * `KeyboardEvent.key` values (UI Events) — single source of truth for key comparisons.
 * @see https://www.w3.org/TR/uievents-key/
 */
export const KEY = {
  CONTROL: "Control",
  META: "Meta",
  ALT: "Alt",
  SHIFT: "Shift",

  ENTER: "Enter",
  ESCAPE: "Escape",
  TAB: "Tab",
  SPACE: " ",
  BACKSPACE: "Backspace",
  DELETE: "Delete",

  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",

  /** Debugger keys, so a reading steps the way a debugger does. */
  F10: "F10",
  F11: "F11",

  SLASH: "/",
  BACKTICK: "`",

  DIGIT_1: "1",
  DIGIT_2: "2",
  DIGIT_3: "3",
  DIGIT_4: "4",

  /** Latin letters (lowercase) — pair with `keyMatchesLetter` for case-insensitive shortcuts. */
  A: "a",
  B: "b",
  C: "c",
  D: "d",
  E: "e",
  F: "f",
  G: "g",
  H: "h",
  I: "i",
  J: "j",
  K: "k",
  L: "l",
  M: "m",
  N: "n",
  O: "o",
  P: "p",
  Q: "q",
  R: "r",
  S: "s",
  T: "t",
  U: "u",
  V: "v",
  W: "w",
  X: "x",
  Y: "y",
  Z: "z",
} as const;
