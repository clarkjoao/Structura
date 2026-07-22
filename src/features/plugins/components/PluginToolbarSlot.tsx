import { Component as ReactComponent, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PluginPanelContext } from "../plugin.types";
import { usePluginPanels } from "../use-plugin-contributions";
import { resolveLocalizedText } from "../localized-text";

interface PluginToolbarSlotProps {
  /** Must be "canvas-toolbar" */
  slot: "canvas-toolbar";
  /** Whether the user is in edit mode */
  isEditMode: boolean;
}

interface BoundaryProps {
  message: string;
  children: ReactNode;
}

/** A crashing plugin panel must not take down the hosting page. */
class PluginToolbarErrorBoundary extends ReactComponent<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("[plugins] toolbar panel crashed:", error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {this.props.message}
        </span>
      );
    }
    return this.props.children;
  }
}

/** Host slot rendering plugin toolbar panels. */
export function PluginToolbarSlot({ slot, isEditMode }: PluginToolbarSlotProps) {
  const { t, i18n } = useTranslation();
  const panels = usePluginPanels(slot);

  const context: PluginPanelContext = useMemo(
    () => ({
      selection: [],
      service: null,
      updateComponent: () => {
        console.warn("[plugins] updateComponent is not available in canvas-toolbar slot");
      },
      updateService: () => {
        console.warn("[plugins] updateService is not available in canvas-toolbar slot");
      },
      locale: i18n.language,
    }),
    [i18n.language],
  );

  if (panels.length === 0) {
    return null;
  }

  return (
    <>
      {panels.map((panel) => {
        const PanelComponent = panel.component;
        return (
          <PluginToolbarErrorBoundary key={panel.id} message={t("plugins.panel.crashed")}>
            <PanelComponent context={context} />
          </PluginToolbarErrorBoundary>
        );
      })}
    </>
  );
}
