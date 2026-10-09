import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, LayoutGrid, PanelBottomClose, PanelBottomOpen, Puzzle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Diagram } from "@/features/diagram";
import type { CatalogEntry } from "@/features/elements/search";
import { PluginToolbarSlot } from "@/features/plugins/components/PluginToolbarSlot";
import { usePluginPanels } from "@/features/plugins/use-plugin-contributions";
import { cn } from "@/lib/utils";
import { usePatternInsert } from "../patterns";
import { useCanvasPreferencesStore } from "../preferences";
import { LayerFilterPopover } from "../toolbar/LayerFilterPopover";
import { VersionsButton } from "../toolbar/components/VersionsButton";
import { ConnectedVersionPanel } from "../toolbar/VersionPanel";
import { CatalogEntryIcon } from "./CatalogEntryIcon";
import { CANVAS_OVERLAY_ATTRIBUTE, useCatalogUiStore } from "./catalogUi.store";
import { ElementCatalog } from "./ElementCatalog";
import { Kbd } from "./Kbd";
import { catalogShortcutLabel } from "./shortcutLabels";
import { registryCatalog, TOOLBAR_TOOLS } from "./toolbarTools";
import { useDockAutoHide } from "./useDockAutoHide";
import { useInsertAtCenter } from "./useInsertAtCenter";

export interface CanvasBottomToolbarProps {
  diagram: Pick<Diagram, "versions" | "activeVersionId">;
  isPanelOpen: boolean;
  /** The insert half — tools, menus, catalog — shows only when the canvas can be edited. */
  canInsert: boolean;
  /** Selects what an insert created. */
  onInserted: (nodeIds: string[]) => void;
  /** The versions panel opens above the toolbar, like the catalog. */
  versions: { locked: boolean; open: boolean; onOpenChange: (open: boolean) => void };
  tags: {
    allTags: string[];
    visibleTags: Set<string> | null;
    locked: boolean;
    onToggle: (tag: string) => void;
    onShowAll: () => void;
    onShowNoTags: () => void;
  };
}

const TOOL_BUTTON_CLASS =
  "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Separator() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

/**
 * The floating toolbar at the bottom of the canvas. Inserting — one-click
 * tools, the C4 and flowchart menus, the element catalog (with the patterns)
 * — then viewing — versions, the tag filter, plugin panels. Fixed, or hiding
 * itself like the macOS Dock (`autoHideBottomToolbar`).
 */
export function CanvasBottomToolbar({
  diagram,
  isPanelOpen,
  canInsert,
  onInserted,
  versions,
  tags,
}: CanvasBottomToolbarProps) {
  const { t, i18n } = useTranslation();
  const open = useCatalogUiStore((state) => state.open);
  const setOpen = useCatalogUiStore((state) => state.setOpen);
  const setAvailable = useCatalogUiStore((state) => state.setAvailable);
  const insertAtCenter = useInsertAtCenter(isPanelOpen, (nodeId) => onInserted([nodeId]));
  const insertPattern = usePatternInsert(isPanelOpen, (nodeIds) => {
    setOpen(false);
    if (nodeIds.length > 0) onInserted(nodeIds);
  });
  const pluginPanels = usePluginPanels("canvas-toolbar");
  const autoHide = useCanvasPreferencesStore((state) => state.autoHideBottomToolbar);
  const setAutoHide = useCanvasPreferencesStore((state) => state.setAutoHideBottomToolbar);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const dock = useDockAutoHide(autoHide, open || versions.open || menuOpen !== null);

  useEffect(() => {
    setAvailable(canInsert);
    return () => setAvailable(false);
  }, [setAvailable, canInsert]);

  /** Keeps the toolbar out while one of its menus or popovers is open. */
  const holdWhileOpen = (id: string) => (isOpen: boolean) =>
    setMenuOpen((current) => (isOpen ? id : current === id ? null : current));

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
  const autoHideLabel = t(
    autoHide ? "elementCatalog.toolbar.keepVisible" : "elementCatalog.toolbar.autoHide",
  );

  const renderMenu = (labelKey: string, menuLabelKey: string, entries: CatalogEntry[]) =>
    entries.length > 0 && (
      <DropdownMenu onOpenChange={holdWhileOpen(labelKey)}>
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

  const insertGroup = canInsert && (
    <>
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
            onInsertPattern={insertPattern}
          />
        </PopoverContent>
      </Popover>
      <Separator />
    </>
  );

  return (
    <>
      {(open || versions.open) && (
        // A light scrim: it marks the catalog or the versions as the focus
        // without hiding the canvas, and lets the pointer through so a catalog
        // tile can be dropped there.
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-foreground/5" />
      )}
      {autoHide && (
        // The edge the pointer reaches to bring a hidden toolbar back.
        <div
          aria-hidden
          data-testid="bottom-toolbar-reveal"
          {...dock.pointerHandlers}
          className="absolute bottom-0 left-1/2 z-10 h-3 w-[min(40rem,100%)] -translate-x-1/2"
        />
      )}
      <div
        role="toolbar"
        aria-label={t("elementCatalog.toolbar.label")}
        data-state={dock.visible ? "visible" : "hidden"}
        {...dock.pointerHandlers}
        {...dock.focusHandlers}
        className={cn(
          "absolute bottom-5 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
          !dock.visible && "pointer-events-none translate-y-[calc(100%+1.5rem)] opacity-0",
        )}
      >
        {insertGroup}
        <Popover open={versions.open} onOpenChange={versions.onOpenChange}>
          <PopoverTrigger asChild>
            <VersionsButton
              diagram={diagram}
              locked={versions.locked}
              open={versions.open}
              className={TOOL_BUTTON_CLASS}
            />
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={10}
            aria-label={t("versions.drawerTitle")}
            {...{ [CANVAS_OVERLAY_ATTRIBUTE]: versions.open ? "open" : "closed" }}
            // The merge confirmation is a dialog of its own, outside the popover:
            // interacting with it must not close the panel that opened it.
            onInteractOutside={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest('[role="alertdialog"], [role="dialog"]')
              ) {
                event.preventDefault();
              }
            }}
            className="w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
          >
            <ConnectedVersionPanel onClose={() => versions.onOpenChange(false)} />
          </PopoverContent>
        </Popover>
        <LayerFilterPopover
          allTags={tags.allTags}
          visibleTags={tags.visibleTags}
          versionsPickerLocked={tags.locked}
          onToggle={tags.onToggle}
          onShowAll={tags.onShowAll}
          onShowNoTags={tags.onShowNoTags}
          onOpenChange={holdWhileOpen("tags")}
          className={TOOL_BUTTON_CLASS}
        />
        {pluginPanels.length > 0 && (
          <Popover onOpenChange={holdWhileOpen("plugins")}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={t("elementCatalog.toolbar.plugins")}
                aria-label={t("elementCatalog.toolbar.plugins")}
                className={TOOL_BUTTON_CLASS}
              >
                <Puzzle aria-hidden className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="flex w-72 flex-col gap-2 p-3">
              <PluginToolbarSlot slot="canvas-toolbar" isEditMode={canInsert} />
            </PopoverContent>
          </Popover>
        )}
        <Separator />
        <button
          type="button"
          aria-pressed={autoHide}
          title={autoHideLabel}
          aria-label={autoHideLabel}
          onClick={() => setAutoHide(!autoHide)}
          className={TOOL_BUTTON_CLASS}
        >
          {/* Not hit-testable: the icon swaps on click, and a removed node under
              the pointer would cost the toolbar its pointerleave. */}
          {autoHide ? (
            <PanelBottomOpen aria-hidden className="pointer-events-none h-4 w-4" />
          ) : (
            <PanelBottomClose aria-hidden className="pointer-events-none h-4 w-4" />
          )}
        </button>
      </div>
    </>
  );
}
