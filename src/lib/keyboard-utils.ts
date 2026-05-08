import { KEY } from "./keyboard-keys";

export { KEY } from "./keyboard-keys";

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
