import { useState, useCallback } from "react";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDiagramStore, ServiceSource } from "@/features/diagram";
import { mapToServiceDefinition } from "../defectdojo.service";
import type { DDSearchResult } from "../types";
import { DefectDojoImportStatus } from "../enums";
import { DefectDojoProductCard } from "./DefectDojoProductCard";
import {
  dedupeStringsPreserveOrder,
  mergeSources,
  normalizeSources,
  pickMoreCompleteString,
  repoUrlsMatch,
} from "../../merge-utils";

interface Props {
  results: DDSearchResult[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRefreshStatuses: () => void;
}

export function DefectDojoResultsList({
  results,
  loading,
  error,
  onRetry,
  onRefreshStatuses,
}: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const selectableIds = results
    .filter((r) => r.status !== DefectDojoImportStatus.Imported)
    .map((r) => r.id);

  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  };

  const toggleProduct = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleImport = () => {
    const toImport = results.filter((r) => selected.has(r.id));
    const store = useDiagramStore.getState();

    let importedCount = 0;
    let updatedCount = 0;

    for (const product of toImport) {
      const svcData = mapToServiceDefinition(product);
      if (product.status === DefectDojoImportStatus.Updated && product.existingServiceId) {
        const existingService = store.serviceRegistry[product.existingServiceId];
        const mergedTech = dedupeStringsPreserveOrder([
          ...(existingService?.technology ?? []),
          ...(svcData.technology ?? []),
        ]);
        const mergedTags = dedupeStringsPreserveOrder([
          ...(existingService?.tags ?? []),
          ...(svcData.tags ?? []),
        ]);
        store.updateService(product.existingServiceId, {
          ...svcData,
          repositoryUrl:
            existingService?.repositoryUrl || svcData.repositoryUrl || "",
          technology: mergedTech,
          tags: mergedTags,
          sources: mergeSources(existingService?.sources, svcData.sources),
          metadata: {
            github: existingService?.metadata?.github,
            defectdojo: {
              ...(existingService?.metadata?.defectdojo ?? {}),
              ...(svcData.metadata?.defectdojo ?? {}),
            },
          },
        });
        updatedCount++;
        continue;
      } else {
        // If the same repo is already imported from GitHub, merge into it.
        const githubExisting = Object.values(store.serviceRegistry).find(
          (s) =>
            normalizeSources(s).some((source) => source.type === ServiceSource.Github) &&
            repoUrlsMatch(s.repositoryUrl, svcData.repositoryUrl),
        );

        if (githubExisting) {
          const prevGithubMeta = githubExisting.metadata?.github;
          const prevDefectDojoMeta = githubExisting.metadata?.defectdojo;
          const nextDefectDojoMeta = svcData.metadata?.defectdojo ?? {};

          store.updateService(githubExisting.id, {
            repositoryUrl: githubExisting.repositoryUrl || svcData.repositoryUrl,
            name: pickMoreCompleteString(svcData.name, githubExisting.name),
            description: pickMoreCompleteString(
              svcData.description,
              githubExisting.description,
            ),
            technology: dedupeStringsPreserveOrder([
              ...(githubExisting.technology ?? []),
              ...(svcData.technology ?? []),
            ]),
            tags: dedupeStringsPreserveOrder([
              ...(githubExisting.tags ?? []),
              ...(svcData.tags ?? []),
            ]),
            sources: mergeSources(githubExisting.sources, svcData.sources),
            metadata: {
              // Preserva metadata do GitHub (fullName, topics, etc.)
              github: prevGithubMeta,
              defectdojo: {
                ...(prevDefectDojoMeta ?? {}),
                ...(nextDefectDojoMeta ?? {}),
              },
            },
          });
          updatedCount++;
        } else {
          store.addService(svcData);
          importedCount++;
        }
      }
    }

    setSelected(new Set());
    onRefreshStatuses();

    const parts: string[] = [];
    if (importedCount > 0)
      parts.push(t("defectdojo.importToastImported", { count: importedCount }));
    if (updatedCount > 0)
      parts.push(t("defectdojo.importToastUpdated", { count: updatedCount }));
    setImportMessage(
      parts.join(t("defectdojo.importToastJoin")) + t("defectdojo.importToastSuccessSuffix"),
    );
    setTimeout(() => setImportMessage(null), 4000);
  };

  const importedCount = results.filter((r) => r.status === DefectDojoImportStatus.Imported).length;

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-border bg-secondary/40"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={onRetry}
          className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
        >
          {t("defectdojo.retryButton")}
        </button>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("defectdojo.emptyResultsHint")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 accent-primary"
            />
            {t("defectdojo.selectAll")}
          </label>
          <span className="text-xs text-muted-foreground">
            {t("defectdojo.resultCount", { count: results.length })}
            {importedCount > 0
              ? t("defectdojo.footerImportedAddon", { count: importedCount })
              : ""}
          </span>
        </div>

        <button
          onClick={handleImport}
          disabled={selected.size === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {t("defectdojo.importSelectedCount", { count: selected.size })}
        </button>
      </div>

      {importMessage && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">
          {t("defectdojo.importSuccessBanner", { message: importMessage })}
        </div>
      )}

      <div className="space-y-2">
        {results.map((product) => (
          <DefectDojoProductCard
            key={product.id}
            product={product}
            selected={selected.has(product.id)}
            onToggle={toggleProduct}
          />
        ))}
      </div>
    </div>
  );
}
