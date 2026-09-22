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
  PERIOD: ".",
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

/**
 * True when `event.key` is a single Latin letter matching `letter`, ignoring case.
 * Example: Cmd+E and Cmd+e both match `keyMatchesLetter(event, "e")`.
 */
export function keyMatchesLetter(event: KeyboardEvent, letter: string): boolean {
  if (letter.length !== 1) return false;
  const k = event.key;
  if (k.length !== 1) return false;
  return k.toLowerCase() === letter.toLowerCase();
}

/**
 * Match a Latin letter by `event.key`, or by physical `event.code` when Option/Alt
 * remaps the character (macOS: Option+L → "¬" while code stays `"KeyL"`).
 *
 * @example keyMatchesLetterOrCode(event, KEY.L, "KeyL")
 */
export function keyMatchesLetterOrCode(
  event: KeyboardEvent,
  letter: string,
  code: string,
): boolean {
  if (keyMatchesLetter(event, letter)) return true;
  return event.code === code;
}

/**
 * True when the event target is a text-entry surface (input, textarea, select,
 * contenteditable, or a Monaco-style `role="textbox"`), including editors that
 * delegate focus to a child. Shortcuts use it to keep out of the user's typing.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;

  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  // Monaco renders div[role="textbox"] as its main editor
  if (el.getAttribute?.("role") === "textbox") return true;
  // Walk up to 5 levels to catch editors that delegate focus to children
  let parent = el.parentElement;
  let depth = 0;
  while (parent && depth < 5) {
    if (parent.isContentEditable) return true;
    const parentTag = parent.tagName;
    if (parentTag === "INPUT" || parentTag === "TEXTAREA") return true;
    if (parent.getAttribute?.("role") === "textbox") return true;
    parent = parent.parentElement;
    depth++;
  }
  return false;
}

export function keyIs(event: { key: string }, key: string): boolean {
  return event.key === key;
}

export function keyIsOneOf(event: { key: string }, keys: readonly string[]): boolean {
  return keys.includes(event.key);
}

/** Enter or Space — common activation pattern (e.g. roving tabindex, cards). */
export function keyIsEnterOrSpace(event: { key: string }): boolean {
  return event.key === KEY.ENTER || event.key === KEY.SPACE;
}
