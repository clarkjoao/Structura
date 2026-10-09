import { getPlatform } from "../hooks/keyboard/helpers";

/** The modifier key as this platform prints it: ⌘ on macOS, Ctrl elsewhere. */
export function modKeyLabel(): string {
  return getPlatform() === "mac" ? "⌘" : "Ctrl+";
}

/** The catalog's shortcut, as shown on its button and in hints. */
export function catalogShortcutLabel(): string {
  return `${modKeyLabel()}K`;
}
