import { useTranslation } from "react-i18next";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceReadOnlyDetails } from "@/pages/serviceCatalog/ServiceReadOnlyDetails";
import { ServiceLinkSection } from "../sections/ServiceLinkSection";

export interface ServicesTabProps {
  componentId: string;
  serviceId: string | null | undefined;
  linkedService: ServiceDefinition | null;
  onSync: () => void;
  onServiceChange: (serviceId: string | null) => void;
}

/**
 * ElementPanel "Services" tab — link/search plus catalog details when linked.
 *
 * @example
 * <ServicesTab
 *   componentId={component.id}
 *   serviceId={component.serviceId}
 *   linkedService={linkedService}
 *   onSync={() => linkedService && syncFromService(linkedService)}
 *   onServiceChange={(id) => linkComponentToService(component.id, id ?? undefined)}
 * />
 */
export function ServicesTab({
  componentId,
  serviceId,
  linkedService,
  onSync,
  onServiceChange,
}: ServicesTabProps) {
  const { t } = useTranslation();

  return (
    <div className="p-4 space-y-4 overflow-auto flex-1">
      <ServiceLinkSection
        componentId={componentId}
        serviceId={serviceId}
        linkedService={linkedService}
        onSync={onSync}
        onServiceChange={onServiceChange}
      />
      {linkedService && (
        <div className="space-y-3 border-t border-border pt-4">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
            {t("common.details")}
          </span>
          <ServiceReadOnlyDetails svc={linkedService} />
        </div>
      )}
    </div>
  );
}
