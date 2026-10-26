/**
 * The pane's classes, the host inspector's (its `PanelSection` and field classes): the plugin
 * cannot import host components, only use the host's Tailwind classes.
 */
export const LABEL_CLASS = "mb-1 block text-xs font-medium text-muted-foreground";

export const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-md border border-border bg-secondary px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";

export const BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50";

export const ICON_BUTTON_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

/** A line of a list that opens where it points: the YAML, or the canvas. */
export const LINK_ROW_CLASS =
  "w-full rounded px-1.5 py-1 text-left text-xs text-foreground hover:bg-accent";

// Lucide's paths (ISC): the plugin bundle does not carry the icon library.
export const FOLDER =
  "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z";
export const SAVE = [
  "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",
  "M7 3v4a1 1 0 0 0 1 1h7",
];
export const RELOAD = [
  "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
  "M21 3v5h-5",
  "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
  "M8 16H3v5",
];
export const UNLINK = [
  "m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71",
  "m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71",
  "M8 2v3",
  "M2 8h3",
  "M16 19v3",
  "M19 16h3",
];
export const PLUS = ["M5 12h14", "M12 5v14"];
export const FILE_PLUS = [
  "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
  "M14 2v4a2 2 0 0 0 2 2h4",
  "M9 15h6",
  "M12 18v-6",
];
export const UPLOAD = ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m17 8-5-5-5 5", "M12 3v12"];
export const ARROW_RIGHT = ["M5 12h14", "m12 5 7 7-7 7"];
