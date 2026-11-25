/**
 * How the preview arranges the workspace: who places the picture, and — when it is the embed —
 * the canvas arrangement's settings (spacing, automatic references). No VSCode API here.
 *
 * - `automatic`: the embed lays every picture out with Structura's canvas arranger, under the
 *   same rules and references as the Arrange menu in Structura (`STRUCTURA_ARRANGE`, the
 *   host's `src/embed/protocol.ts`). A text edit moves nothing; a structural one re-arranges.
 * - `manual`: the extension's own stable placement and the layout sidecar, as before; no
 *   references.
 *
 * The bounds and defaults mirror the host's `src/features/diagram/model/layout-settings.ts`,
 * which the extension cannot import. The embed normalises what it receives anyway, so a drift
 * only changes what the menu offers.
 */
export type ArrangeMode = "automatic" | "manual";
export type ArrangeDensity = "compact" | "normal" | "spacious";
export type ArrangeReferenceMode = "rules" | "auto" | "off";

export interface ArrangeSettings {
  mode: ArrangeMode;
  density: ArrangeDensity;
  references: ArrangeReferenceMode;
  /** Under `rules`: a back-connection further back than this many columns ends on a reference. */
  refNeighborColumns: number;
  /** Under `rules`: the fewest connections an original keeps. */
  refMinKeep: number;
  /** Under `rules`: a forward connection longer than `REF_FORWARD_COLUMNS` ends on a reference. */
  refForward: boolean;
}

const REF_NEIGHBOR_COLUMNS = { min: 1, max: 6, default: 2 } as const;
const REF_MIN_KEEP = { min: 1, max: 5, default: 1 } as const;
const REF_FORWARD_COLUMNS = 6;

const DENSITIES: readonly ArrangeDensity[] = ["compact", "normal", "spacious"];
const REFERENCE_MODES: readonly ArrangeReferenceMode[] = ["rules", "auto", "off"];

/** A folder with no saved choice: arranged like the canvas, with the canvas defaults. */
export const DEFAULT_ARRANGE: ArrangeSettings = {
  mode: "automatic",
  density: "normal",
  references: "rules",
  refNeighborColumns: REF_NEIGHBOR_COLUMNS.default,
  refMinKeep: REF_MIN_KEEP.default,
  refForward: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const oneOf = <T extends string>(value: unknown, options: readonly T[]): T | undefined =>
  options.find((option) => option === value);

const integerIn = (value: unknown, bounds: { min: number; max: number }): number | undefined =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.min(bounds.max, Math.max(bounds.min, value)))
    : undefined;

/** A saved choice, with the defaults for anything missing or no longer valid. */
export function readArrangeSettings(stored: unknown): ArrangeSettings {
  if (!isRecord(stored)) return { ...DEFAULT_ARRANGE };
  return {
    mode: oneOf(stored["mode"], ["automatic", "manual"] as const) ?? DEFAULT_ARRANGE.mode,
    density: oneOf(stored["density"], DENSITIES) ?? DEFAULT_ARRANGE.density,
    references: oneOf(stored["references"], REFERENCE_MODES) ?? DEFAULT_ARRANGE.references,
    refNeighborColumns:
      integerIn(stored["refNeighborColumns"], REF_NEIGHBOR_COLUMNS) ??
      DEFAULT_ARRANGE.refNeighborColumns,
    refMinKeep: integerIn(stored["refMinKeep"], REF_MIN_KEEP) ?? DEFAULT_ARRANGE.refMinKeep,
    refForward:
      typeof stored["refForward"] === "boolean" ? stored["refForward"] : DEFAULT_ARRANGE.refForward,
  };
}

/** The `arrange` the preview posts with every graph, and alone in `STRUCTURA_ARRANGE`. */
export function arrangeMessage(settings: ArrangeSettings): {
  mode: ArrangeMode;
  settings: Omit<ArrangeSettings, "mode">;
} {
  const { mode, ...rest } = settings;
  return { mode, settings: rest };
}

const REFERENCE_LABEL: Readonly<Record<ArrangeReferenceMode, string>> = {
  rules: "Rules",
  auto: "Trial",
  off: "Off",
};

/** For the status bar and the menu's placeholder. */
export function describeArrange(settings: ArrangeSettings): string {
  if (settings.mode === "manual") return "Manual";
  return `Automatic · ${settings.density} · references: ${REFERENCE_LABEL[settings.references].toLowerCase()}`;
}

/** What picking a menu item does: new settings, or a number to ask for first. */
export type ArrangeAction =
  | { next: ArrangeSettings }
  | { ask: "refNeighborColumns" | "refMinKeep"; min: number; max: number; default: number };

export interface ArrangeMenuItem {
  label: string;
  description?: string;
  /** A heading; picks nothing. */
  separator?: true;
  action?: ArrangeAction;
}

const current = (yes: boolean) => (yes ? "current" : "");

/**
 * The Arrange menu: the mode, and in automatic mode the spacing and the references, with
 * the rules' own settings under Rules. Every item says what it would set.
 */
export function arrangeMenu(settings: ArrangeSettings): ArrangeMenuItem[] {
  const set = (patch: Partial<ArrangeSettings>): ArrangeAction => ({
    next: { ...settings, ...patch },
  });
  const items: ArrangeMenuItem[] = [
    { label: "Mode", separator: true },
    {
      label: "Automatic",
      description: [
        current(settings.mode === "automatic"),
        "arranged like Structura's canvas (default)",
      ]
        .filter(Boolean)
        .join(" · "),
      action: set({ mode: "automatic" }),
    },
    {
      label: "Manual",
      description: [current(settings.mode === "manual"), "stable placement and the layout sidecar"]
        .filter(Boolean)
        .join(" · "),
      action: set({ mode: "manual" }),
    },
  ];
  if (settings.mode === "manual") return items;

  items.push({ label: "Spacing", separator: true });
  for (const density of DENSITIES) {
    items.push({
      label: density[0]!.toUpperCase() + density.slice(1),
      description: current(settings.density === density),
      action: set({ density }),
    });
  }

  items.push({ label: "References", separator: true });
  const hints: Record<ArrangeReferenceMode, string> = {
    rules: "far back-connections end on a reference (default)",
    auto: "kept only where the drawing reads better",
    off: "no automatic references",
  };
  for (const references of REFERENCE_MODES) {
    items.push({
      label: REFERENCE_LABEL[references],
      description: [current(settings.references === references), hints[references]]
        .filter(Boolean)
        .join(" · "),
      action: set({ references }),
    });
  }
  if (settings.references === "rules") {
    items.push(
      {
        label: "$(arrow-left) Back-connections stay up to…",
        description: `${settings.refNeighborColumns} column${settings.refNeighborColumns === 1 ? "" : "s"} back (default ${REF_NEIGHBOR_COLUMNS.default})`,
        action: { ask: "refNeighborColumns", ...REF_NEIGHBOR_COLUMNS },
      },
      {
        label: "$(pin) Connections kept on the original",
        description: `${settings.refMinKeep} (default ${REF_MIN_KEEP.default})`,
        action: { ask: "refMinKeep", ...REF_MIN_KEEP },
      },
      {
        label: `$(${settings.refForward ? "check" : "circle-large-outline"}) Long forward lines too`,
        description: `forward over ${REF_FORWARD_COLUMNS} columns ends on a reference`,
        action: set({ refForward: !settings.refForward }),
      },
    );
  }
  return items;
}

/**
 * Whether the picture must be laid out again for the change: always in automatic mode (any
 * setting changes the arrangement), and when switching modes.
 */
export function arrangeChanged(before: ArrangeSettings, after: ArrangeSettings): boolean {
  if (before.mode !== after.mode) return true;
  if (after.mode === "manual") return false;
  return JSON.stringify(arrangeMessage(before)) !== JSON.stringify(arrangeMessage(after));
}
