import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceRow } from "./ServiceRow";

export function ServicesCategoryPanel({
  services,
  filteredServices,
  onCanvasServiceIds,
  onAddRegistry,
  onClose,
}: {
  services: ServiceDefinition[];
  filteredServices: ServiceDefinition[];
  onCanvasServiceIds: Set<string>;
  onAddRegistry: (serviceId: string, name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("elementPicker.servicesEmpty")}</p>
        <Link
          to="/services"
          className="text-sm font-medium text-primary hover:underline"
          onClick={onClose}
        >
          {t("elementPicker.openServices")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredServices.map((svc) => {
        const isOnCanvas = onCanvasServiceIds.has(svc.id);
        return (
          <ServiceRow
            key={svc.id}
            svc={svc}
            isOnCanvas={isOnCanvas}
            onAdd={() => onAddRegistry(svc.id, svc.name)}
            variant="default"
          />
        );
      })}
    </div>
  );
}
