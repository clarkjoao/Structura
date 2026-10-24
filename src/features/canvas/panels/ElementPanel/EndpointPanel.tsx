import { useState } from "react";
import { X, GripVertical, Plus } from "lucide-react";
import { CommitField, ElementScaffold, PanelSection } from "./shell";
import { generateId } from "@/features/diagram";
import type {
  EndpointComponent,
  EndpointHandler,
  HttpMethod,
  ComponentPatch,
} from "@/features/diagram";
import { METHOD_COLORS } from "../../nodes/EndpointNode";
import { useTranslation } from "react-i18next";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "EVENT"];

interface EndpointPanelProps {
  component: EndpointComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  availableFlows: { id: string; name: string }[];
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
}

export default function EndpointPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  availableFlows,
  focusTitleTrigger,
  onFocusElement,
}: EndpointPanelProps) {
  const { t } = useTranslation();
  const [expandedHandlerId, setExpandedHandlerId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handlers = component.handlers ?? [];

  const updateHandler = (handlerId: string, patch: Partial<EndpointHandler>) => {
    updateComponent(component.id, {
      handlers: handlers.map((h) => (h.id === handlerId ? { ...h, ...patch } : h)),
    });
  };

  const reorderHandlers = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...handlers];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    updateComponent(component.id, { handlers: next });
  };

  const addHandler = () => {
    updateComponent(component.id, {
      handlers: [
        ...handlers,
        { id: generateId("handler"), label: t("endpointPanel.newHandler"), flowId: undefined },
      ],
    });
  };

  const removeHandler = (handlerId: string) => {
    updateComponent(component.id, {
      handlers: handlers.filter((h) => h.id !== handlerId),
    });
    if (expandedHandlerId === handlerId) setExpandedHandlerId(null);
  };

  return (
    <ElementScaffold
      component={component}
      onClose={onClose}
      updateComponent={updateComponent}
      removeComponent={removeComponent}
      onFocusElement={onFocusElement}
      focusTitleTrigger={focusTitleTrigger}
      namePlaceholder={t("endpointPanel.panelTitle")}
      showPosition={false}
    >
      <PanelSection title={t("panelShell.sectionWhat")}>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("endpointPanel.method")}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {HTTP_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateComponent(component.id, { method: m })}
                className="rounded px-2 py-1 text-[10px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: METHOD_COLORS[m] }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("endpointPanel.pathLabel")}
          </label>
          <CommitField
            mono
            value={component.path}
            onCommit={(value) => updateComponent(component.id, { path: value })}
            placeholder={t("endpointPanel.pathPlaceholder")}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("endpointPanel.description")}
          </label>
          <CommitField
            multiline
            value={component.endpointDescription ?? ""}
            onCommit={(value) =>
              updateComponent(component.id, { endpointDescription: value || undefined })
            }
            placeholder={t("endpointPanel.optionalPlaceholder")}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("endpointPanel.handlersLabel")}
            </label>
            <button
              type="button"
              onClick={addHandler}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10"
            >
              <Plus className="h-3 w-3" /> {t("endpointPanel.add")}
            </button>
          </div>
          <div className="space-y-0.5 max-h-48 overflow-auto">
            {handlers.map((handler, i) => (
              <div key={handler.id}>
                <div
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragIdx !== null) setOverIdx(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIdx !== null && dragIdx !== i) reorderHandlers(dragIdx, i);
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onClick={() =>
                    setExpandedHandlerId(expandedHandlerId === handler.id ? null : handler.id)
                  }
                  className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-secondary/50 transition-colors ${
                    dragIdx === i ? "opacity-40" : ""
                  } ${
                    overIdx === i && dragIdx !== null && dragIdx !== i
                      ? "ring-1 ring-primary/50"
                      : ""
                  }`}
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 cursor-grab" />
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {expandedHandlerId === handler.id ? "▾" : "▸"}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground w-4 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <span className="truncate flex-1">{handler.label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeHandler(handler.id);
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    title={t("endpointPanel.removeHandlerTitle")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {expandedHandlerId === handler.id && (
                  <div className="pl-7 pr-2 pb-2 pt-0.5 space-y-2 border-l-2 border-border ml-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        {t("endpointPanel.labelField")}
                      </label>
                      <CommitField
                        value={handler.label}
                        onCommit={(value) => updateHandler(handler.id, { label: value })}
                        placeholder={t("endpointPanel.handlerLabelPlaceholder")}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        {t("endpointPanel.descriptionOptional")}
                      </label>
                      <CommitField
                        value={handler.description ?? ""}
                        onCommit={(value) =>
                          updateHandler(handler.id, { description: value || undefined })
                        }
                        placeholder={t("endpointPanel.optionalPlaceholder")}
                      />
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        {t("endpointPanel.flowLabel")}
                      </label>
                      <select
                        value={handler.flowId ?? ""}
                        onChange={(e) =>
                          updateHandler(handler.id, {
                            flowId: e.target.value || undefined,
                          })
                        }
                        className="w-full rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">{t("elementPanel.noneOption")}</option>
                        {availableFlows.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </PanelSection>
    </ElementScaffold>
  );
}
