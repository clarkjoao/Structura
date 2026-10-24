/** Shared classes for the inspector's fields: compact (≈32 px) inputs, sentence-case labels. */
export const PANEL_LABEL_CLASS = "mb-1 block text-xs font-medium text-muted-foreground";

export const PANEL_INPUT_CLASS =
  "h-8 w-full rounded-md border border-border bg-secondary px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export const PANEL_TEXTAREA_CLASS =
  "min-h-8 w-full resize-none overflow-hidden rounded-md border border-border bg-secondary px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export const PANEL_ADD_CLASS =
  "flex h-8 w-full items-center rounded-md border border-dashed border-border px-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground";

/** The header's name: reads as a title, shows its field chrome on hover and focus. */
export const PANEL_TITLE_CLASS =
  "w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-base font-semibold leading-snug text-foreground placeholder:text-muted-foreground hover:border-border focus:border-ring focus:outline-none";
