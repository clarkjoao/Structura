import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import {
  catalogGroupCounts,
  searchCatalog,
  type CatalogEntry,
  type CatalogGroup,
} from "@/features/elements/search";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { cn } from "@/lib/utils";
import { useCanvasPreferencesStore } from "../preferences";
import { CatalogEntryIcon } from "./CatalogEntryIcon";
import { CatalogPreview } from "./CatalogPreview";
import { CatalogResultRow } from "./CatalogResultRow";
import { CATALOG_PRESETS_GROUP_ID } from "./canvasCatalogIndex";
import { startCatalogEntryDrag } from "./catalogDrag";
import {
  ALL_GROUPS,
  browseSections,
  cycleGroup,
  moveActive,
  searchSections,
  sectionRows,
  type CatalogMove,
  type CatalogOption,
  type CatalogSection,
} from "./catalogViewModel";
import { Kbd } from "./Kbd";
import { useCanvasCatalogIndex } from "./useCanvasCatalogIndex";

export interface ElementCatalogProps {
  /** Insert at the viewport center. `keepOpen` is ⇧↵. */
  onInsert: (entry: CatalogEntry, keepOpen: boolean) => void;
}

const SECTION_LABEL_CLASS =
  "font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground";

const ARROWS: ReadonlyArray<[string, CatalogMove]> = [
  [KEY.ARROW_UP, "up"],
  [KEY.ARROW_DOWN, "down"],
  [KEY.ARROW_LEFT, "left"],
  [KEY.ARROW_RIGHT, "right"],
];

/** Keeps focus in the search field for controls that are clicked, never dragged. */
function keepInputFocus(event: React.MouseEvent) {
  event.preventDefault();
}

/**
 * The element catalog: browse by group or search everything, keyboard first.
 * Focus stays in the search field; the list follows `aria-activedescendant`.
 */
export function ElementCatalog({ onInsert }: ElementCatalogProps) {
  const { t } = useTranslation();
  const listId = useId();
  const { index, byId } = useCanvasCatalogIndex();
  const recentIds = useCanvasPreferencesStore((state) => state.recentCatalogEntryIds);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>(ALL_GROUPS);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => catalogGroupCounts(index), [index]);
  const result = useMemo(() => (query.trim() ? searchCatalog(index, query) : null), [index, query]);
  const recents = useMemo(
    () => recentIds.map((id) => byId.get(id)).filter((entry): entry is CatalogEntry => !!entry),
    [recentIds, byId],
  );

  const sections = useMemo(
    () =>
      result
        ? searchSections(index, result, activeGroup)
        : browseSections(index, recents, activeGroup),
    [index, result, recents, activeGroup],
  );
  const rows = useMemo(() => sectionRows(sections), [sections]);
  const options = useMemo(() => {
    const map = new Map<string, CatalogOption>();
    for (const section of sections) for (const item of section.options) map.set(item.key, item);
    return map;
  }, [sections]);

  /** Chips, with the number each would show: entries when browsing, hits when searching. */
  const chips = useMemo(() => {
    const countFor = (group: CatalogGroup) =>
      result ? (result.countsByGroup.get(group.id) ?? 0) : (counts.get(group.id) ?? 0);
    const groups = index.groups
      .map((group) => ({ group, count: countFor(group) }))
      .filter(
        ({ group, count }) =>
          count > 0 ||
          group.id === activeGroup ||
          (!result && group.id === CATALOG_PRESETS_GROUP_ID),
      );
    return {
      all: result ? result.hits.length : index.entries.length,
      groups,
      order: [ALL_GROUPS, ...groups.map(({ group }) => group.id)],
    };
  }, [index, counts, result, activeGroup]);

  // A new view starts on its first option.
  useEffect(() => {
    setActiveKey(rows[0]?.[0] ?? null);
  }, [rows]);

  useEffect(() => {
    if (!activeKey) return;
    document.getElementById(`${listId}-${activeKey}`)?.scrollIntoView({ block: "nearest" });
  }, [activeKey, listId]);

  useEffect(() => {
    chipsRef.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeGroup]);

  const active = activeKey ? options.get(activeKey) : undefined;

  const selectGroup = (groupId: string) => {
    setActiveGroup(groupId);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    for (const [key, move] of ARROWS) {
      if (!keyIs(event, key)) continue;
      // In a result list, ← and → stay with the text caret.
      if (result && (move === "left" || move === "right")) return;
      event.preventDefault();
      setActiveKey((current) => moveActive(rows, current, move));
      return;
    }
    if (keyIs(event, KEY.TAB)) {
      event.preventDefault();
      setActiveGroup((current) => cycleGroup(chips.order, current, event.shiftKey));
      return;
    }
    if (keyIs(event, KEY.ENTER)) {
      event.preventDefault();
      if (active) onInsert(active.entry, event.shiftKey);
    }
  };

  const optionProps = (item: CatalogOption) => ({
    id: `${listId}-${item.key}`,
    role: "option" as const,
    "aria-selected": item.key === activeKey,
    tabIndex: -1,
    draggable: true,
    onDragStart: (event: React.DragEvent) => startCatalogEntryDrag(event, item.entry.id),
    // Neither `preventDefault` on mousedown nor a refocus while the button is
    // pressed: both cancel the drag. A click closes the catalog anyway; a drag
    // hands focus back to the field when it ends.
    onDragEnd: () => inputRef.current?.focus(),
    onMouseMove: () => {
      if (item.key !== activeKey) setActiveKey(item.key);
    },
    onClick: () => onInsert(item.entry, false),
  });

  const renderSection = (section: CatalogSection) => {
    switch (section.kind) {
      case "recents":
        return (
          <section
            key={section.key}
            role="group"
            aria-label={t("elementCatalog.recents")}
            className="mb-4"
          >
            <h3 className={cn(SECTION_LABEL_CLASS, "mb-2")}>{t("elementCatalog.recents")}</h3>
            <div role="presentation" className="flex flex-wrap gap-1.5">
              {section.options.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  {...optionProps(item)}
                  className={cn(
                    "flex h-7 max-w-[11rem] items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                    item.key === activeKey
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-foreground hover:bg-surface-hover",
                  )}
                >
                  <CatalogEntryIcon entry={item.entry} size={16} />
                  <span className="truncate">{item.entry.label}</span>
                </button>
              ))}
            </div>
          </section>
        );
      case "grid":
        return (
          <section key={section.key} role="group" aria-label={section.group.label} className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className={SECTION_LABEL_CLASS}>
                {section.group.label}{" "}
                <span className="text-muted-foreground/70">{section.total}</span>
              </h3>
              {section.total > section.options.length && (
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={keepInputFocus}
                  onClick={() => selectGroup(section.group.id)}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {t("elementCatalog.viewAll", { count: section.total })}
                </button>
              )}
            </div>
            {section.options.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {section.group.id === CATALOG_PRESETS_GROUP_ID
                  ? t("elementCatalog.presetsEmpty")
                  : null}
              </p>
            ) : (
              <div role="presentation" className="grid grid-cols-4 gap-1.5">
                {section.options.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    {...optionProps(item)}
                    title={item.entry.label}
                    className={cn(
                      "flex h-11 min-w-0 items-center gap-2 rounded-lg border px-2 text-left text-xs transition-colors",
                      item.key === activeKey
                        ? "border-primary bg-primary/10"
                        : "border-transparent bg-muted/40 hover:bg-surface-hover",
                    )}
                  >
                    <CatalogEntryIcon entry={item.entry} size={28} />
                    <span className="line-clamp-2 text-foreground">{item.entry.label}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      case "best":
        return (
          <section
            key={section.key}
            role="group"
            aria-label={t("elementCatalog.bestMatch")}
            className="mb-3"
          >
            <h3 className={cn(SECTION_LABEL_CLASS, "mb-1.5")}>{t("elementCatalog.bestMatch")}</h3>
            {section.options.map((item) => (
              <CatalogResultRow
                key={item.key}
                item={item}
                query={query}
                variant="best"
                groupLabel={index.groups.find((g) => g.id === item.entry.groupId)?.label}
                active={item.key === activeKey}
                optionProps={optionProps(item)}
              />
            ))}
          </section>
        );
      case "results":
        return (
          <section key={section.key} role="group" aria-label={section.group.label} className="mb-3">
            <h3 className={cn(SECTION_LABEL_CLASS, "mb-1")}>
              {section.group.label}{" "}
              <span className="text-muted-foreground/70">{section.options.length}</span>
            </h3>
            {section.options.map((item) => (
              <CatalogResultRow
                key={item.key}
                item={item}
                query={query}
                variant="row"
                active={item.key === activeKey}
                optionProps={optionProps(item)}
              />
            ))}
          </section>
        );
    }
  };

  const trimmed = query.trim();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <label className="relative block">
          <span className="sr-only">{t("elementCatalog.searchLabel")}</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeKey ? `${listId}-${activeKey}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("elementCatalog.searchPlaceholder", { count: index.entries.length })}
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Kbd className="absolute right-2.5 top-1/2 -translate-y-1/2">Esc</Kbd>
        </label>
      </div>

      <div
        ref={chipsRef}
        role="group"
        aria-label={t("elementCatalog.categoriesLabel")}
        className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-3 py-2 [scrollbar-width:none]"
      >
        {[
          { id: ALL_GROUPS, label: t("elementCatalog.all"), count: chips.all },
          ...chips.groups.map(({ group, count }) => ({ ...group, count })),
        ].map((chip) => {
          const pressed = chip.id === activeGroup;
          return (
            <button
              key={chip.id}
              type="button"
              tabIndex={-1}
              aria-pressed={pressed}
              onMouseDown={keepInputFocus}
              onClick={() => selectGroup(chip.id)}
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

      <div className="flex min-h-0 flex-1">
        <div
          id={listId}
          role="listbox"
          aria-label={t("elementCatalog.title")}
          className="min-w-0 flex-1 overflow-y-auto p-3"
        >
          {sections.length === 0 && trimmed ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
              <p className="text-sm text-foreground">
                {t("elementCatalog.noResultsFor", { query: trimmed })}
              </p>
              <p className="text-xs text-muted-foreground">{t("elementCatalog.noResultsHint")}</p>
            </div>
          ) : (
            sections.map(renderSection)
          )}
        </div>
        {result && active && (
          <CatalogPreview
            entry={active.entry}
            groupLabel={index.groups.find((g) => g.id === active.entry.groupId)?.label}
            onInsert={() => onInsert(active.entry, false)}
          />
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↑↓←→</Kbd> {t("elementCatalog.hints.navigate")}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> {t("elementCatalog.hints.insert")}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>⇧↵</Kbd> {t("elementCatalog.hints.keepOpen")}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Tab</Kbd> {t("elementCatalog.hints.category")}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Esc</Kbd> {t("elementCatalog.hints.close")}
        </span>
        <span className="ml-auto">{t("elementCatalog.hints.drag")}</span>
      </div>
    </div>
  );
}
