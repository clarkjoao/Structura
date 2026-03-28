import { X } from "lucide-react";
import { useAllComponents, useActiveDiagram, useFlows, useDiagramActions, generateId } from "@/features/diagram";
import type { ApiGroupComponent, ApiProtocol, ComponentPatch, EndpointComponent } from "@/features/diagram";
import { isEndpointComponent } from "@/features/diagram";
import { PROTOCOL_COLORS, METHOD_COLORS } from "../../nodes/ApiGroupNode/constants";
import { useTranslation } from "react-i18next";

const PROTOCOLS: ApiProtocol[] = ["REST", "gRPC", "GraphQL", "WebSocket"];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "EVENT"] as const;

interface ApiGroupPanelProps {
  component: ApiGroupComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
}

export default function ApiGroupPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
}: ApiGroupPanelProps) {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const allComponents = useAllComponents();
  const flows = useFlows();
  const { addComponent } = useDiagramActions();
  const availableFlows = flows.map((f) => ({ id: f.id, name: f.name }));

  const endpoints = allComponents
    .filter((c) => c.parentId === component.id && isEndpointComponent(c))
    .sort((a, b) => {
      const ay = diagram?.nodeLayouts[a.id]?.y ?? 0;
      const by = diagram?.nodeLayouts[b.id]?.y ?? 0;
      return ay - by;
    }) as EndpointComponent[];

  return (
    <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("apiGroup.panelTitle")}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Service Name */}
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("apiGroup.serviceName")}
          </label>
          <input
            value={component.serviceName}
            onChange={(e) => updateComponent(component.id, { serviceName: e.target.value })}
            placeholder={t("apiGroup.orderServicePlaceholder")}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Protocol */}
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            {t("apiGroup.protocolLabel")}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PROTOCOLS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateComponent(component.id, { protocol: p })}
                className={`rounded px-2 py-1 text-[10px] font-bold transition-colors border-l-4 ${
                  component.protocol === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-surface-hover"
                }`}
                style={{ borderLeftColor: PROTOCOL_COLORS[p] }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Base Path */}
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("apiGroup.basePathLabel")}
          </label>
          <input
            value={component.basePath}
            onChange={(e) => updateComponent(component.id, { basePath: e.target.value })}
            placeholder={t("apiGroup.basePathPlaceholder")}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* SLA / Rate Limit */}
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("apiGroup.slaRateLimitLabel")}
          </label>
          <input
            value={component.sla ?? ""}
            onChange={(e) => updateComponent(component.id, { sla: e.target.value || undefined })}
            placeholder={t("apiGroup.slaPlaceholder")}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {t("apiGroup.slaHint")}
          </p>
        </div>

        {/* Endpoints list */}
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("apiGroup.endpointsCount", { count: endpoints.length })}
          </label>
          <div className="space-y-1.5">
            {endpoints.map((ep) => (
              <div
                key={ep.id}
                className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 border border-border group"
              >
                <select
                  value={ep.method}
                  onChange={(e) =>
                    updateComponent(ep.id, { method: e.target.value as EndpointComponent["method"] })
                  }
                  className="text-[10px] font-bold rounded px-1 py-0.5 text-white border-0 cursor-pointer shrink-0"
                  style={{ backgroundColor: METHOD_COLORS[ep.method] ?? "#888" }}
                >
                  {HTTP_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  value={ep.path}
                  onChange={(e) => updateComponent(ep.id, { path: e.target.value })}
                  className="flex-1 min-w-0 text-[11px] font-mono bg-transparent border-0 text-foreground focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
                  placeholder={t("apiGroup.pathPlaceholder")}
                />
                <select
                  value={ep.handlers?.[0]?.flowId ?? ""}
                  onChange={(e) => {
                    const flowId = e.target.value || undefined;
                    const handlers = flowId
                      ? [
                          {
                            id: ep.handlers?.[0]?.id ?? generateId("handler"),
                            label: t("apiGroup.defaultHandlerLabel"),
                            flowId,
                          },
                        ]
                      : [];
                    updateComponent(ep.id, { handlers } as ComponentPatch);
                  }}
                  className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5 text-muted-foreground max-w-[80px] truncate shrink-0"
                  title={t("apiGroup.associateFlowTitle")}
                >
                  <option value="">{t("apiGroup.noFlowOption")}</option>
                  {availableFlows.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeComponent(ep.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 p-0.5"
                  title={t("apiGroup.removeEndpointTitle")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addComponent("endpoint", t("canvas.newEndpoint"), component.id)}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-hover transition-colors"
          >
            {t("apiGroup.addEndpoint")}
          </button>
        </div>

        {/* Remove API Group */}
        <div className="pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => removeComponent(component.id)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/50 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" /> {t("apiGroup.removeApiGroup")}
          </button>
        </div>
      </div>
    </div>
  );
}
