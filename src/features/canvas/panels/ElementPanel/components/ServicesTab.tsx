import { useTranslation } from "react-i18next";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceReadOnlyDetails } from "@/pages/services/ServiceReadOnlyDetails";
import { ServiceLinkField } from "@/features/canvas/palette/ServiceLinkField";

export interface ServicesTabProps {
  componentId: string;
  /** The element's name: it drives the palette's title, suggestion and "create". */
  elementName: string;
  seed: Omit<ServiceDefinition, "id">;
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
 *   elementName={component.name}
 *   seed={serviceSeedFromComponent(component)}
 *   serviceId={component.serviceId}
 *   linkedService={linkedService}
 *   onSync={() => linkedService && syncFromService(linkedService)}
 *   onServiceChange={(id) => linkComponentToService(component.id, id ?? undefined)}
 * />
 */
export function ServicesTab({
  componentId,
  elementName,
  seed,
  serviceId,
  linkedService,
  onSync,
  onServiceChange,
}: ServicesTabProps) {
  const { t } = useTranslation();

  return (
    <div className="p-4 space-y-4 overflow-auto flex-1">
      <ServiceLinkField
        componentId={componentId}
        elementName={elementName}
        seed={seed}
        serviceId={serviceId}
        linkedService={linkedService}
        onSync={onSync}
        onServiceChange={onServiceChange}
      />
      {linkedService && (
        <div className="space-y-3 border-t border-border pt-4">
          <span className="text-xs font-medium text-muted-foreground block">
            {t("common.details")}
          </span>
          <ServiceReadOnlyDetails svc={linkedService} />
        </div>
      )}
    </div>
  );
}
