import { ExternalLink, ExternalLink as ExternalLinkIcon, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeSources } from "@/features/integrations/merge-utils";
import type { ServiceDefinition } from "@/features/diagram";
import { SOURCE_BADGE } from "./registry.constants";
import { sourceTypeLabel } from "./registryLabels";

export interface ServiceReadOnlyDetailsProps {
  svc: ServiceDefinition;
}

/**
 * Read-only service fields shared by the catalog DetailPanel and ElementPanel Services tab.
 *
 * @example
 * <ServiceReadOnlyDetails svc={linkedService} />
 */
export function ServiceReadOnlyDetails({ svc }: ServiceReadOnlyDetailsProps) {
  const { t } = useTranslation();
  const normalizedSources = normalizeSources(svc);
  const defectDojoProductLink = (
    svc.metadata?.defectdojo as { productLink?: string } | undefined
  )?.productLink;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground w-20 shrink-0">
          {t("common.source")}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {normalizedSources.map((source) => (
            <span
              key={source.type}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[source.type]}`}
            >
              {sourceTypeLabel(t, source.type)}
            </span>
          ))}
        </div>
      </div>

      <div>
        <span className="text-[11px] text-muted-foreground block mb-0.5">
          {t("common.description")}
        </span>
        <p className="text-sm text-foreground">
          {svc.description || (
            <span className="text-muted-foreground italic">{t("common.noDescription")}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground w-20 shrink-0">{t("common.owner")}</span>
        {svc.owner ? (
          <span className="text-sm text-foreground flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            {svc.owner}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground italic">{t("common.emDash")}</span>
        )}
      </div>

      {svc.repositoryUrl && (
        <div className="flex items-start gap-2">
          <span className="text-[11px] text-muted-foreground w-20 shrink-0 pt-0.5">
            {t("common.repo")}
          </span>
          <a
            href={svc.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{svc.repositoryUrl}</span>
          </a>
        </div>
      )}

      {defectDojoProductLink && (
        <div className="flex items-start gap-2">
          <span className="text-[11px] text-muted-foreground w-20 shrink-0 pt-0.5">
            {t("registry.productLabel")}
          </span>
          <a
            href={defectDojoProductLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{defectDojoProductLink}</span>
          </a>
        </div>
      )}

      <div>
        <span className="text-[11px] text-muted-foreground block mb-1">{t("common.technology")}</span>
        {svc.technology.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {svc.technology.map((techStr) => (
              <span
                key={techStr}
                className="text-[11px] font-mono rounded bg-secondary px-2 py-0.5 text-secondary-foreground"
              >
                {techStr}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground italic">{t("common.emDash")}</span>
        )}
      </div>

      <div>
        <span className="text-[11px] text-muted-foreground block mb-1">{t("common.tags")}</span>
        {(svc.tags ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {(svc.tags ?? []).map((tagStr) => (
              <span
                key={tagStr}
                className="text-[10px] rounded bg-secondary/60 px-2 py-0.5 text-muted-foreground"
              >
                #{tagStr}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground italic">{t("common.emDash")}</span>
        )}
      </div>

      {(svc.externalLinks ?? []).length > 0 && (
        <div>
          <span className="text-[11px] text-muted-foreground block mb-1">
            {t("externalLinks.sectionTitle")}
          </span>
          <div className="flex flex-col gap-1">
            {(svc.externalLinks ?? []).map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1.5 truncate"
              >
                <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{link.label || link.url}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
