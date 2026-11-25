import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleHelp, Copy } from "lucide-react";
import type { Component, ComponentPatch } from "@/features/diagram";
import { isPluginComponentType } from "@/features/diagram";
import { isUnknownComponent } from "@/features/diagram/model/component.guards";
import { ElementScaffold, PanelSection } from "./shell";

interface UnknownElementPanelProps {
  component: Component;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
}

/** Why the canvas could not draw it: content kept as it came, a missing plugin, or a removed type. */
function reasonOf(component: Component): "content" | "plugin" | "removed" {
  if (isUnknownComponent(component)) return "content";
  return isPluginComponentType(component.type) ? "plugin" : "removed";
}

/**
 * An element Structura cannot draw. Says why in plain words (the header already names the type it
 * was saved as) and keeps its content one copy away — nothing here offers fields that do not apply to it.
 */
export default function UnknownElementPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger = 0,
  onFocusElement,
}: UnknownElementPanelProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const reason = reasonOf(component);
  const content = isUnknownComponent(component) ? (component.rawContent ?? "") : "";
  const plugin = reason === "plugin" ? component.type.split("/")[0] : undefined;

  const copy = () => {
    void navigator.clipboard?.writeText(content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <ElementScaffold
      component={component}
      onClose={onClose}
      updateComponent={updateComponent}
      removeComponent={removeComponent}
      onFocusElement={onFocusElement}
      focusTitleTrigger={focusTitleTrigger}
      namePlaceholder={t("unknownNode.defaultName")}
      sizable
      minWidth={200}
      minHeight={120}
    >
      <PanelSection title={t("panelShell.sectionWhat")}>
        <div
          className="flex gap-2.5 rounded-md border border-dashed border-border px-3 py-2.5"
          data-testid="unknown-element-notice"
        >
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t(`unknownElementPanel.title.${reason}`)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(`unknownElementPanel.body.${reason}`, { plugin })}
            </p>
          </div>
        </div>
      </PanelSection>
      {reason === "content" && (
        <PanelSection title={t("unknownElementPanel.content")}>
          {content.trim() ? (
            <div className="relative">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-secondary/40 p-2.5 pr-9 font-mono text-[11px] leading-relaxed text-foreground">
                {content}
              </pre>
              <button
                type="button"
                onClick={copy}
                title={t("unknownElementPanel.copy")}
                aria-label={t("unknownElementPanel.copy")}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("unknownNode.emptyHint")}</p>
          )}
        </PanelSection>
      )}
    </ElementScaffold>
  );
}
