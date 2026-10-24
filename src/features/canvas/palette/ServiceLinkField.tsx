import { useMemo, useState } from "react";
import { Link2, RefreshCw, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ServiceSource, useAllServices, useDiagramActions } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import { LinkPalette } from "./LinkPalette";
import { LinkTrigger } from "./LinkTrigger";
import { buildServiceLinkSource, suggestService, type ServiceRef } from "./serviceLinkItems";

export interface ServiceLinkFieldProps {
  componentId: string;
  elementName: string;
  /** What the element already says, so a service made from it keeps it. */
  seed: Omit<ServiceDefinition, "id">;
  serviceId: string | null | undefined;
  linkedService: ServiceDefinition | null;
  onSync: () => void;
  onServiceChange: (serviceId: string | null) => void;
}

/**
 * The Services tab's link, the same trigger and palette as the linked diagram: what the element is
 * linked to, a palette to change it, Unlink beside it, and Sync on the label's row.
 */
export function ServiceLinkField({
  componentId,
  elementName,
  seed,
  serviceId,
  linkedService,
  onSync,
  onServiceChange,
}: ServiceLinkFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const broken = Boolean(serviceId) && linkedService === null;

  return (
    <>
      <LinkTrigger
        anchorId={`element-panel-service-${componentId}`}
        icon={<Link2 className="h-3 w-3" />}
        label={t("elementPanel.linkService")}
        linkedName={linkedService?.name ?? (broken ? (serviceId ?? null) : null)}
        broken={broken}
        emptyLabel={t("serviceLink.linkAction")}
        missingLabel={t("serviceLink.missing")}
        unlinkLabel={t("serviceLink.unlink")}
        onOpen={() => setOpen(true)}
        onUnlink={() => onServiceChange(null)}
        headerActions={
          <button
            type="button"
            onClick={onSync}
            disabled={!linkedService}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title={t("elementPanel.syncFromServiceTitle")}
          >
            <RefreshCw className="h-3 w-3" />
            {t("elementPanel.syncButton")}
          </button>
        }
      />
      {open && (
        <ServiceLinkPalette
          open={open}
          onOpenChange={setOpen}
          elementName={elementName}
          seed={seed}
          currentServiceId={serviceId}
          onPick={(id) => onServiceChange(id)}
        />
      )}
    </>
  );
}

interface ServiceLinkPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elementName: string;
  seed: Omit<ServiceDefinition, "id">;
  currentServiceId: string | null | undefined;
  onPick: (serviceId: string) => void;
}

/** The link palette fed with the service registry. Mounted only while open. */
function ServiceLinkPalette({
  open,
  onOpenChange,
  elementName,
  seed,
  currentServiceId,
  onPick,
}: ServiceLinkPaletteProps) {
  const { t } = useTranslation();
  const services = useAllServices();
  const { addService } = useDiagramActions();
  const source = useMemo(
    () =>
      buildServiceLinkSource(services, {
        sourceLabel: (id) =>
          id === ServiceSource.Github
            ? t("serviceLink.sources.github")
            : id === ServiceSource.Defectdojo
              ? t("serviceLink.sources.defectdojo")
              : t("serviceLink.sources.manual"),
        icon: <Server className="h-4 w-4" />,
      }),
    [services, t],
  );
  const name = elementName.trim();
  const suggestions = useMemo(
    () => suggestService(source.items, name, t("serviceLink.sameName")),
    [source.items, name, t],
  );

  return (
    <LinkPalette<ServiceRef>
      open={open}
      onOpenChange={onOpenChange}
      title={t("serviceLink.title", { name: name || t("common.unnamedElement") })}
      items={source.items}
      groups={source.groups}
      suggestions={suggestions}
      createAction={name ? { label: t("serviceLink.createAndLink", { name }) } : undefined}
      currentId={currentServiceId}
      searchPlaceholder={t("serviceLink.searchPlaceholder")}
      onPick={(item) => onPick(item.payload.id)}
      onCreate={() => {
        // The registry becomes the source of the element's data: seed it from the element.
        const created = addService({ ...seed, name });
        onPick(created.id);
      }}
    />
  );
}
