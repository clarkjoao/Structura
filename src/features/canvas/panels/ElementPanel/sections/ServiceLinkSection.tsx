import { Link2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ServiceDefinition } from "@/features/diagram";
import ServiceRegistryCombobox from "../components/ServiceRegistryCombobox";

export interface ServiceLinkSectionProps {
  componentId: string;
  serviceId: string | null | undefined;
  linkedService: ServiceDefinition | null;
  onSync: () => void;
  onServiceChange: (serviceId: string | null) => void;
}

export function ServiceLinkSection({
  componentId,
  serviceId,
  linkedService,
  onSync,
  onServiceChange,
}: ServiceLinkSectionProps) {
  const { t } = useTranslation();

  return (
    <div id={`element-panel-service-${componentId}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
          <Link2 className="h-3 w-3 inline mr-1" />
          {t("elementPanel.linkService")}
        </label>
        <button
          type="button"
          onClick={onSync}
          disabled={!linkedService}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
          title={t("elementPanel.syncFromServiceTitle")}
        >
          <RefreshCw className="h-3 w-3" />
          {t("elementPanel.syncButton")}
        </button>
      </div>
      <ServiceRegistryCombobox value={serviceId ?? null} onChange={onServiceChange} />
    </div>
  );
}
