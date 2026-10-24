import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, Search, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { cn } from "@/lib/utils";
import { ALL_GROUPS, cycleGroup, moveActive, type CatalogMove } from "../catalog/catalogViewModel";
import { CANVAS_OVERLAY_ATTRIBUTE } from "../catalog/catalogUi.store";
import { Kbd } from "../catalog/Kbd";
import { filterItems } from "./palette.search";
import type {
  PaletteCreateAction,
  PaletteGroup,
  PaletteItem,
  PalettePick,
  PaletteSuggestion,
} from "./palette.types";

/** The chip for items listed as recent. Not a group the caller defines. */
const RECENTS_CHIP = "recents";

/** Stable defaults: a fresh `[]` per render would reset the active option on every keystroke. */
const NO_IDS: readonly string[] = [];
const NO_SUGGESTIONS: readonly never[] = [];

/** Cards per row. */
const GRID_COLUMNS = 3;

const SECTION_LABEL_CLASS =
  "font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground";

const ARROWS: ReadonlyArray<[string, CatalogMove]> = [
  [KEY.ARROW_UP, "up"],
  [KEY.ARROW_DOWN, "down"],
  [KEY.ARROW_LEFT, "left"],
  [KEY.ARROW_RIGHT, "right"],
];

export interface LinkPaletteProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being linked, for the line at the top ("Link diagram to Checkout"). */
  title: string;
  items: readonly PaletteItem<T>[];
  groups: readonly PaletteGroup[];
  /** Item ids shown under the "Recent" chip, most recent first. */
  recentIds?: readonly string[];
  /** Put first, with the reason each was picked. Shown while browsing, not while searching. */
  suggestions?: readonly PaletteSuggestion<T>[];
  /** "Create '<name>' and link" — offered beside the suggestions. */
  createAction?: PaletteCreateAction;
  /** The item already linked: marked, never hidden. */
  currentId?: string | null;
  searchPlaceholder: string;
  onPick: (item: PaletteItem<T>, pick: PalettePick) => void;
  onCreate?: (pick: PalettePick) => void;
}

type Option<T> =
  | { key: string; kind: "item"; item: PaletteItem<T>; reason?: string }
  | { key: string; kind: "create" };

/**
 * A palette that picks one thing from a source: the catalog's overlay, big search, category chips,
 * card grid and shortcut footer, without the catalog's insertion. The caller supplies the items and
 * decides what picking does, so a diagram link, a service link or anything else shares this.
 */
export function LinkPalette<T>({
  open,
  onOpenChange,
  title,
  items,
  groups,
  recentIds = NO_IDS,
  suggestions = NO_SUGGESTIONS,
  createAction,
  currentId,
  searchPlaceholder,
  onPick,
  onCreate,
}: LinkPaletteProps<T>) {
  const { t } = useTranslation();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>(ALL_GROUPS);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setGroup(ALL_GROUPS);
  }, [open]);

  const groupLabel = useMemo(() => {
    const map = new Map(groups.map((g) => [g.id, g.label]));
    return (id: string) => map.get(id) ?? "";
  }, [groups]);

  const recents = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    return recentIds.map((id) => byId.get(id)).filter((item): item is PaletteItem<T> => !!item);
  }, [items, recentIds]);

  const chips = useMemo(() => {
    const countOf = (id: string) => items.filter((item) => item.groupIds.includes(id)).length;
    return [
      { id: ALL_GROUPS, label: t("linkPalette.all"), count: items.length },
      ...(recents.length > 0
        ? [{ id: RECENTS_CHIP, label: t("linkPalette.recents"), count: recents.length }]
        : []),
      ...groups
        .map((g) => ({ id: g.id, label: g.label, count: countOf(g.id) }))
        .filter((chip) => chip.count > 0),
    ];
  }, [items, groups, recents, t]);

  const trimmed = query.trim();
  const browsing = trimmed === "" && group === ALL_GROUPS;

  const listed = useMemo(() => {
    const inGroup =
      group === ALL_GROUPS
        ? items
        : group === RECENTS_CHIP
          ? recents
          : items.filter((item) => item.groupIds.includes(group));
    return filterItems(inGroup, query, groupLabel);
  }, [items, recents, group, query, groupLabel]);

  const featured = useMemo(
    () => (browsing ? suggestions : NO_SUGGESTIONS),
    [browsing, suggestions],
  );
  const suggestedIds = useMemo(() => new Set(featured.map((s) => s.item.id)), [featured]);
  const showCreate = browsing && createAction !== undefined;

  const options = useMemo(() => {
    const out: Option<T>[] = [];
    for (const suggestion of featured) {
      out.push({
        key: `s:${suggestion.item.id}`,
        kind: "item",
        item: suggestion.item,
        reason: suggestion.reason,
      });
    }
    if (showCreate) out.push({ key: "create", kind: "create" });
    for (const item of listed) {
      if (suggestedIds.has(item.id)) continue;
      out.push({ key: `i:${item.id}`, kind: "item", item });
    }
    return out;
  }, [featured, showCreate, listed, suggestedIds]);

  const rows = useMemo(() => {
    const out: string[][] = [];
    const lead = options.filter((o) => o.key.startsWith("s:") || o.key === "create");
    for (const option of lead) out.push([option.key]);
    const grid = options.filter((o) => o.key.startsWith("i:"));
    for (let i = 0; i < grid.length; i += GRID_COLUMNS) {
      out.push(grid.slice(i, i + GRID_COLUMNS).map((o) => o.key));
    }
    return out;
  }, [options]);

  useEffect(() => {
    setActiveKey(rows[0]?.[0] ?? null);
  }, [rows]);

  useEffect(() => {
    if (!activeKey) return;
    document.getElementById(`${listId}-${activeKey}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeKey, listId]);

  const choose = (option: Option<T>, pick: PalettePick) => {
    onOpenChange(false);
    if (option.kind === "create") onCreate?.(pick);
    else onPick(option.item, pick);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    for (const [key, move] of ARROWS) {
      if (!keyIs(event, key)) continue;
      // The text caret keeps ← and → while there is a query to edit.
      if (trimmed && (move === "left" || move === "right")) return;
      event.preventDefault();
      setActiveKey((current) => moveActive(rows, current, move));
      return;
    }
    if (keyIs(event, KEY.TAB)) {
      event.preventDefault();
      setGroup((current) =>
        cycleGroup(
          chips.map((chip) => chip.id),
          current,
          event.shiftKey,
        ),
      );
      return;
    }
    if (keyIs(event, KEY.ENTER)) {
      event.preventDefault();
      const active = options.find((option) => option.key === activeKey);
      if (active) choose(active, { open: event.metaKey || event.ctrlKey });
    }
  };

  const optionProps = (option: Option<T>) => ({
    id: `${listId}-${option.key}`,
    role: "option" as const,
    "aria-selected": option.key === activeKey,
    tabIndex: -1,
    onMouseMove: () => {
      if (option.key !== activeKey) setActiveKey(option.key);
    },
    onClick: (event: React.MouseEvent) => choose(option, { open: event.metaKey || event.ctrlKey }),
  });

  const card = (option: Extract<Option<T>, { kind: "item" }>, emphasised = false) => {
    const { item } = option;
    const isCurrent = item.id === currentId;
    return (
      <button
        key={option.key}
        type="button"
        {...optionProps(option)}
        title={item.label}
        className={cn(
          "flex min-h-14 min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
          option.key === activeKey
            ? "border-primary bg-primary/10"
            : emphasised
              ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
              : "border-transparent bg-muted/40 hover:bg-surface-hover",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
          {item.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium text-foreground">{item.label}</span>
            {item.meta && (
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[10px] text-muted-foreground">
                {item.meta}
              </span>
            )}
          </span>
          {option.reason ? (
            <span className="flex items-center gap-1 truncate text-xs text-primary">
              <Sparkles className="h-3 w-3 shrink-0" />
              {option.reason}
            </span>
          ) : (
            item.description && (
              <span className="line-clamp-1 text-xs text-muted-foreground">{item.description}</span>
            )
          )}
        </span>
        {isCurrent && (
          <Check className="h-4 w-4 shrink-0 text-primary" aria-label={t("linkPalette.linked")} />
        )}
      </button>
    );
  };

  const leadOptions = options.filter((o) => o.key.startsWith("s:") || o.key === "create");
  const gridOptions = options.filter((o): o is Extract<Option<T>, { kind: "item" }> =>
    o.key.startsWith("i:"),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...{ [CANVAS_OVERLAY_ATTRIBUTE]: open ? "open" : "closed" }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(`${listId}-input`)?.focus();
        }}
        className="flex h-[min(620px,82vh)] max-w-3xl flex-col gap-0 overflow-hidden p-0"
      >
        <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
          <DialogTitle className="pr-8 text-sm font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">{t("linkPalette.description")}</DialogDescription>
          <label className="relative mt-3 block">
            <span className="sr-only">{searchPlaceholder}</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id={`${listId}-input`}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeKey ? `${listId}-${activeKey}` : undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-12 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Kbd className="absolute right-3 top-1/2 -translate-y-1/2">Esc</Kbd>
          </label>
        </div>

        <div
          ref={chipsRef}
          role="group"
          aria-label={t("linkPalette.categories")}
          className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-4 py-2 [scrollbar-width:none]"
        >
          {chips.map((chip) => {
            const pressed = chip.id === group;
            return (
              <button
                key={chip.id}
                type="button"
                tabIndex={-1}
                aria-pressed={pressed}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setGroup(chip.id)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  pressed
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {chip.label}
                <span className="font-mono text-[10px] text-muted-foreground">{chip.count}</span>
              </button>
            );
          })}
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label={title}
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          {options.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm text-foreground">
                {trimmed
                  ? t("linkPalette.noResultsFor", { query: trimmed })
                  : t("linkPalette.empty")}
              </p>
            </div>
          ) : (
            <>
              {leadOptions.length > 0 && (
                <section role="group" aria-label={t("linkPalette.suggested")} className="mb-4">
                  <h3 className={cn(SECTION_LABEL_CLASS, "mb-2")}>{t("linkPalette.suggested")}</h3>
                  <div role="presentation" className="flex flex-col gap-1.5">
                    {leadOptions.map((option) =>
                      option.kind === "create" ? (
                        <button
                          key={option.key}
                          type="button"
                          {...optionProps(option)}
                          className={cn(
                            "flex min-h-11 items-center gap-2.5 rounded-lg border border-dashed px-2.5 py-2 text-left text-sm transition-colors",
                            option.key === activeKey
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-surface-hover",
                          )}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                            <Plus className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 truncate font-medium text-foreground">
                            {createAction?.label}
                          </span>
                        </button>
                      ) : (
                        card(option, true)
                      ),
                    )}
                  </div>
                </section>
              )}
              {gridOptions.length > 0 && (
                <section role="group" aria-label={t("linkPalette.all")}>
                  {leadOptions.length > 0 && (
                    <h3 className={cn(SECTION_LABEL_CLASS, "mb-2")}>{t("linkPalette.all")}</h3>
                  )}
                  <div role="presentation" className="grid grid-cols-3 gap-1.5">
                    {gridOptions.map((option) => card(option))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> {t("linkPalette.hints.link")}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>⌘↵</Kbd> {t("linkPalette.hints.linkAndOpen")}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Tab</Kbd> {t("linkPalette.hints.category")}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> {t("linkPalette.hints.close")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
