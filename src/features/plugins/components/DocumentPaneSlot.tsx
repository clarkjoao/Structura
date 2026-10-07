import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FileCode2, X } from "lucide-react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import type { PluginComponentPatch, PluginPanelContext, PluginServicePatch } from "../plugin.types";
import { resolveLocalizedText } from "../localized-text";
import { sanitizeComponentPatch, sanitizeServicePatch } from "../snapshots";
import { usePluginPanels } from "../use-plugin-contributions";
import { PluginErrorBoundary } from "./PluginErrorBoundary";
import { getOpenPaneId, setOpenPaneId, subscribe } from "./document-pane-state";

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 480;

/** Canvas-toolbar toggles, one per `document-pane` panel (plugin API 1.4). */
export function DocumentPaneToggles() {
  const { i18n } = useTranslation();
  const panels = usePluginPanels("document-pane");
  const open = useSyncExternalStore(subscribe, getOpenPaneId);
  if (panels.length === 0) return null;
  return (
    <>
      {panels.map((panel) => {
        const active = open === panel.id;
        return (
          <button
            key={panel.id}
            type="button"
            aria-pressed={active}
            onClick={() => setOpenPaneId(active ? null : panel.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            {resolveLocalizedText(panel.title, i18n.language)}
          </button>
        );
      })}
    </>
  );
}

/** The open `document-pane` panel, docked right of the canvas and resizable. */
export function DocumentPaneSlot({ isEditMode }: { isEditMode: boolean }) {
  const { t, i18n } = useTranslation();
  const panels = usePluginPanels("document-pane");
  const open = useSyncExternalStore(subscribe, getOpenPaneId);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const updateComponentAction = useDiagramStore((state) => state.updateComponent);
  const updateServiceAction = useDiagramStore((state) => state.updateService);

  const context: PluginPanelContext = useMemo(
    () => ({
      selection: [],
      service: null,
      updateComponent: (id: string, patch: PluginComponentPatch) =>
        updateComponentAction(id, sanitizeComponentPatch(patch)),
      updateService: (id: string, patch: PluginServicePatch) =>
        updateServiceAction(id, sanitizeServicePatch(patch)),
      locale: i18n.language,
      isEditMode,
    }),
    [i18n.language, isEditMode, updateComponentAction, updateServiceAction],
  );

  const panel = panels.find((candidate) => candidate.id === open);
  if (!panel) return null;
  const PanelComponent = panel.component;

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const startX = event.clientX;
    const startWidth = width;
    const move = (e: PointerEvent) =>
      setWidth(
        Math.max(MIN_WIDTH, Math.min(window.innerWidth * 0.7, startWidth + startX - e.clientX)),
      );
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <aside
      className="relative flex min-h-0 shrink-0 flex-col border-l border-border bg-background"
      style={{ width }}
      aria-label={resolveLocalizedText(panel.title, i18n.language)}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("plugins.documentPane.resize")}
        onPointerDown={startResize}
        className="absolute left-0 top-0 z-10 h-full w-1 -translate-x-1/2 cursor-col-resize hover:bg-primary/40"
      />
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium">
          {resolveLocalizedText(panel.title, i18n.language)}
        </span>
        <button
          type="button"
          onClick={() => setOpenPaneId(null)}
          aria-label={t("plugins.documentPane.close")}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <PluginErrorBoundary
          key={panel.id}
          label="document pane"
          fallback={
            <div role="alert" className="p-3 text-xs text-destructive">
              {t("plugins.panel.crashed")}
            </div>
          }
        >
          <PanelComponent context={context} />
        </PluginErrorBoundary>
      </div>
    </aside>
  );
}
