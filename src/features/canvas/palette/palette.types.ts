import type { ReactNode } from "react";

/** One thing a link palette can pick. `payload` is whatever the caller needs back on pick. */
export interface PaletteItem<T> {
  id: string;
  label: string;
  /** A second line on the card. */
  description?: string;
  /** Quiet metadata beside the label ("Imported"); never part of the title. */
  meta?: string;
  /** Categories the item is listed under, besides "All". */
  groupIds: readonly string[];
  icon?: ReactNode;
  /** Extra words the search matches on. */
  keywords?: readonly string[];
  payload: T;
}

export interface PaletteGroup {
  id: string;
  label: string;
}

/** An item the palette puts first, with why. */
export interface PaletteSuggestion<T> {
  item: PaletteItem<T>;
  reason: string;
}

/** "Create '<name>' and link": a source that can make the thing it is asked to pick. */
export interface PaletteCreateAction {
  label: string;
}

export interface PalettePick {
  /** ⌘↵: pick, then go to it. */
  open: boolean;
}
