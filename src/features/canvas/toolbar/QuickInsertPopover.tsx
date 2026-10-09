import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { searchCatalog, type CatalogEntry, type CatalogHit } from "@/features/elements/search";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { cn } from "@/lib/utils";
import { useCanvasPreferencesStore } from "../preferences";
import { CatalogEntryIcon } from "../catalog/CatalogEntryIcon";
import { CANVAS_OVERLAY_ATTRIBUTE, useCatalogUiStore } from "../catalog/catalogUi.store";
import { HighlightedText } from "../catalog/HighlightedText";
import { Kbd } from "../catalog/Kbd";
import { catalogShortcutLabel } from "../catalog/shortcutLabels";
import { useCanvasCatalogIndex } from "../catalog/useCanvasCatalogIndex";
import { useCatalogInsert } from "../catalog/useCatalogInsert";

const POPOVER_W = 320;
const POPOVER_H_MAX = 400;
/** Search hits listed; the full catalog is one click away for the rest. */
const MAX_HITS = 30;
/** The group offered when the field is empty, after Recents. */
const TOP_GROUP_ID = "c4";

interface QuickInsertPopoverProps {
  screenPos: { x: number; y: number };
  flowPos: { x: number; y: number };
  /** Set when a connection was dropped on empty canvas: the new node is connected from it. */
  sourceNodeId?: string | null;
  sourceName?: string;
  onInsert: (newNodeId: string) => void;
  onClose: () => void;
}

interface QuickOption {
  key: string;
  entry: CatalogEntry;
  hit?: CatalogHit;
}

interface QuickSection {
  key: string;
  label: string;
  options: QuickOption[];
}

const SECTION_LABEL_CLASS =
  "px-3 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground";

/**
 * Compact insert at a point: Recents and the C4 elements when empty, the
 * catalog search when typing. Picking an entry after a dropped connection
 * creates the node and the edge as one undo step.
 */
const QuickInsertPopover = memo(function QuickInsertPopover({
  screenPos,
  flowPos,
  sourceNodeId,
  sourceName,
  onInsert,
  onClose,
}: QuickInsertPopoverProps) {
  const { t } = useTranslation();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { index, byId } = useCanvasCatalogIndex();
  const recentIds = useCanvasPreferencesStore((state) => state.recentCatalogEntryIds);
  const insert = useCatalogInsert();

  const restoreFocusRef = useRef(true);

  // Hand focus back to whatever had it — the canvas, usually — on close;
  // not when the full catalog takes over, which focuses its own field.
  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    return () => {
      if (!restoreFocusRef.current) return;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  const sections = useMemo((): QuickSection[] => {
    if (query.trim()) {
      const hits = searchCatalog(index, query).hits.slice(0, MAX_HITS);
      if (hits.length === 0) return [];
      return [
        {
          key: "results",
          label: t("elementCatalog.results"),
          options: hits.map((hit) => ({ key: `results:${hit.entry.id}`, entry: hit.entry, hit })),
        },
      ];
    }
    const recents = recentIds
      .map((id) => byId.get(id))
      .filter((entry): entry is CatalogEntry => !!entry);
    const top = index.entries.filter((entry) => entry.groupId === TOP_GROUP_ID);
    const result: QuickSection[] = [];
    if (recents.length > 0) {
      result.push({
        key: "recents",
        label: t("elementCatalog.recents"),
        options: recents.map((entry) => ({ key: `recents:${entry.id}`, entry })),
      });
    }
    result.push({
      key: "top",
      label: t("elementCatalog.quickInsert.top"),
      options: top.map((entry) => ({ key: `top:${entry.id}`, entry })),
    });
    return result;
  }, [query, index, byId, recentIds, t]);

  const options = useMemo(() => sections.flatMap((section) => section.options), [sections]);

  useEffect(() => {
    setActiveKey(options[0]?.key ?? null);
  }, [options]);

  useEffect(() => {
    if (!activeKey) return;
    document.getElementById(`${listId}-${activeKey}`)?.scrollIntoView({ block: "nearest" });
  }, [activeKey, listId]);

  const pick = (entry: CatalogEntry) => {
    const nodeId = insert(entry, {
      position: { x: flowPos.x + 20, y: flowPos.y + 20 },
      sourceNodeId,
    });
    if (nodeId) onInsert(nodeId);
  };

  const openFullCatalog = () => {
    restoreFocusRef.current = false;
    onClose();
    useCatalogUiStore.getState().setOpen(true);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (keyIs(event, KEY.ESCAPE)) {
      event.preventDefault();
      onClose();
      return;
    }
    if (keyIs(event, KEY.ARROW_DOWN) || keyIs(event, KEY.ARROW_UP)) {
      event.preventDefault();
      const at = options.findIndex((option) => option.key === activeKey);
      const next = keyIs(event, KEY.ARROW_DOWN)
        ? Math.min(at + 1, options.length - 1)
        : Math.max(at - 1, 0);
      setActiveKey(options[next]?.key ?? null);
      return;
    }
    if (keyIs(event, KEY.ENTER)) {
      event.preventDefault();
      const active = options.find((option) => option.key === activeKey);
      if (active) pick(active.entry);
    }
  };

  const left = Math.max(8, Math.min(screenPos.x + 8, window.innerWidth - POPOVER_W - 8));
  const top = Math.max(8, Math.min(screenPos.y + 8, window.innerHeight - POPOVER_H_MAX - 8));
  const trimmed = query.trim();

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={t("elementCatalog.quickInsert.label")}
      {...{ [CANVAS_OVERLAY_ATTRIBUTE]: "open" }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl"
      style={{ left, top, width: POPOVER_W, maxHeight: POPOVER_H_MAX }}
    >
      {sourceNodeId && sourceName !== undefined && (
        <p className="truncate border-b border-border px-3 py-2 text-xs font-medium text-foreground">
          {t("elementCatalog.quickInsert.connectTo", { name: sourceName })}
        </p>
      )}
      <div className="p-2">
        <label className="relative block">
          <span className="sr-only">{t("elementCatalog.searchLabel")}</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
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
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label={t("elementCatalog.quickInsert.label")}
        className="min-h-0 flex-1 overflow-y-auto pb-1"
      >
        {sections.length === 0 && trimmed ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t("elementCatalog.noResultsFor", { query: trimmed })}
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.key} role="group" aria-label={section.label}>
              <p className={SECTION_LABEL_CLASS}>{section.label}</p>
              {section.options.map((option) => {
                const active = option.key === activeKey;
                const { hit } = option;
                return (
                  <button
                    key={option.key}
                    id={`${listId}-${option.key}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => {
                      if (!active) setActiveKey(option.key);
                    }}
                    onClick={() => pick(option.entry)}
                    className={cn(
                      "mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                      active ? "border-primary bg-primary/10" : "border-transparent",
                    )}
                  >
                    <CatalogEntryIcon entry={option.entry} size={16} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">
                        <HighlightedText
                          text={option.entry.label}
                          ranges={hit?.matchedOn === "name" ? hit.ranges : []}
                        />
                      </span>
                      {hit && hit.matchedOn !== "name" && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {t(`elementCatalog.matchedOn.${hit.matchedOn}`)}:{" "}
                          <HighlightedText text={hit.matchedText} ranges={hit.ranges} />
                        </span>
                      )}
                    </span>
                    {hit && (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {index.groups.find((group) => group.id === option.entry.groupId)?.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={openFullCatalog}
        className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-primary transition-colors hover:bg-surface-hover"
      >
        {t("elementCatalog.quickInsert.openCatalog")}
        <Kbd>{catalogShortcutLabel()}</Kbd>
      </button>
    </div>
  );
});

export default QuickInsertPopover;
