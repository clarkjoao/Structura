import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CatalogEntry } from "@/features/elements/search";
import { cn } from "@/lib/utils";
import { CatalogEntryIcon } from "./CatalogEntryIcon";
import { CANVAS_OVERLAY_ATTRIBUTE, useCatalogUiStore } from "./catalogUi.store";
import { ElementCatalog } from "./ElementCatalog";
import { Kbd } from "./Kbd";
import { catalogShortcutLabel } from "./shortcutLabels";
import { registryCatalog, TOOLBAR_TOOLS } from "./toolbarTools";
import { useInsertAtCenter } from "./useInsertAtCenter";

interface CanvasBottomToolbarProps {
  isPanelOpen: boolean;
  /** Selects the node an insert created. */
  onInserted: (nodeId: string) => void;
}

const TOOL_BUTTON_CLASS =
  "flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Separator() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

/**
 * The floating toolbar at the bottom of the canvas: one-click inserts, the C4
 * and flowchart menus, and the element catalog.
 */
export function CanvasBottomToolbar({ isPanelOpen, onInserted }: CanvasBottomToolbarProps) {
  const { t, i18n } = useTranslation();
  const open = useCatalogUiStore((state) => state.open);
  const setOpen = useCatalogUiStore((state) => state.setOpen);
  const setAvailable = useCatalogUiStore((state) => state.setAvailable);
  const insertAtCenter = useInsertAtCenter(isPanelOpen, onInserted);

  useEffect(() => {
    setAvailable(true);
    return () => setAvailable(false);
  }, [setAvailable]);

  const { tools, c4, flowchart } = useMemo(() => {
    const catalog = registryCatalog();
    return {
      tools: TOOLBAR_TOOLS.flatMap((tool) => {
        const entry = catalog.byId.get(tool.entryId);
        return entry ? [{ tool, entry }] : [];
      }),
      c4: catalog.entries.filter((entry) => entry.groupId === "c4"),
      flowchart: catalog.entries.filter((entry) => entry.groupId === "flowchart"),
    };
    // Rebuilt per language: the labels are resolved in the catalog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const shortcut = catalogShortcutLabel();

  const renderMenu = (labelKey: string, menuLabelKey: string, entries: CatalogEntry[]) =>
    entries.length > 0 && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={t(menuLabelKey)} className={TOOL_BUTTON_CLASS}>
            {t(labelKey)}
            <ChevronDown aria-hidden className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="max-h-80 overflow-y-auto">
          {entries.map((entry) => (
            <DropdownMenuItem
              key={entry.id}
              onSelect={() => insertAtCenter(entry)}
              className="gap-2 text-xs"
            >
              <CatalogEntryIcon entry={entry} size={16} />
              {entry.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  return (
    <>
      {open && (
        // A light scrim: it marks the catalog as the focus without hiding the
        // canvas, and lets the pointer through so a tile can be dropped there.
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-foreground/5" />
      )}
      <div
        role="toolbar"
        aria-label={t("elementCatalog.toolbar.label")}
        className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm"
      >
        {tools.map(({ tool, entry }) => {
          const label = t(tool.labelKey);
          const title = t("elementCatalog.toolbar.withShortcut", {
            label,
            shortcut: tool.key.toUpperCase(),
          });
          return (
            <button
              key={tool.id}
              type="button"
              title={title}
              aria-label={title}
              onClick={() => insertAtCenter(entry)}
              className={TOOL_BUTTON_CLASS}
            >
              <CatalogEntryIcon entry={entry} size={16} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
        <Separator />
        {renderMenu("elementCatalog.toolbar.c4", "elementCatalog.toolbar.c4Menu", c4)}
        {renderMenu(
          "elementCatalog.toolbar.flowchart",
          "elementCatalog.toolbar.flowchartMenu",
          flowchart,
        )}
        <Separator />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("elementCatalog.toolbar.catalogAria")}
              aria-keyshortcuts={shortcut.replace("⌘", "Meta+")}
              className={cn(
                TOOL_BUTTON_CLASS,
                "border",
                open
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-transparent text-foreground",
              )}
            >
              <LayoutGrid aria-hidden className="h-4 w-4" />
              {t("elementCatalog.toolbar.catalog")}
              <Kbd>{shortcut}</Kbd>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={10}
            aria-label={t("elementCatalog.title")}
            {...{ [CANVAS_OVERLAY_ATTRIBUTE]: open ? "open" : "closed" }}
            className="h-[500px] max-h-[calc(100vh-7rem)] w-[760px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
          >
            <ElementCatalog
              onInsert={(entry, keepOpen) => {
                insertAtCenter(entry);
                if (!keepOpen) setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
