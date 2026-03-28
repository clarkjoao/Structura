import { Link2, Lock, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ServiceDefinition } from "@/features/diagram";
import { useCollab } from "@/features/collaboration";
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
  const { isGuest } = useCollab();

  return (
    <div id={`element-panel-service-${componentId}`} className="relative">
      {isGuest && (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed rounded-md bg-background/60 backdrop-blur-[1px] flex items-center justify-center"
          title={t("collaboration.notAvailableInCollab")}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-md px-2 py-1 shadow-sm">
            <Lock className="h-3 w-3" />
            {t("collaboration.notAvailableInCollab")}
          </div>
        </div>
      )}
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
