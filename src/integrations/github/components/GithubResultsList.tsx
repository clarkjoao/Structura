import { useMemo } from "react";
import type { GithubRepo } from "../github.types";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";
import { normalizeRepoUrl, normalizeSources } from "../../merge-utils";
import { GithubRepoCard } from "./GithubRepoCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface Props {
  results: GithubRepo[];
  selected: Set<number>;
  totalCount: number;
  loading: boolean;
  allServices: ServiceDefinition[];
  nameStartsFilter?: string;
  onToggleSelect: (repoId: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onLoadMore: () => void;
  onImport: () => void;
}

export function GithubResultsList({
  results,
  selected,
  totalCount,
  loading,
  allServices,
  nameStartsFilter,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onLoadMore,
  onImport,
}: Props) {
  const { t } = useTranslation();
  const importedByRepoUrl = useMemo(() => {
    const map = new Map<string, ServiceDefinition>();
    for (const svc of allServices) {
      const key = normalizeRepoUrl(svc.repositoryUrl);
      if (!key) continue;
      map.set(key, svc);
    }
    return map;
  }, [allServices]);

  const visibleResults = useMemo(() => {
    if (!nameStartsFilter) return results;
    const prefix = nameStartsFilter.trim().toLowerCase();
    if (!prefix) return results;
    return results.filter((r) => r.name.toLowerCase().startsWith(prefix));
  }, [results, nameStartsFilter]);

  const selectedCount = selected.size;

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/30 p-4 text-sm text-muted-foreground">
        {t("github.emptyRepoList")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onSelectAll}
            disabled={results.length === 0}
          >
            {t("github.selectAllRepos")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onClearSelection}
            disabled={selectedCount === 0}
          >
            {t("github.clearSelectionShort")}
          </Button>
          <Badge variant="secondary" className="bg-secondary/70">
            {t("github.resultsTotal", { count: totalCount })}
          </Badge>
        </div>

        <div className="text-sm text-muted-foreground">
          {t("github.selectedTotal", { count: selectedCount })}
        </div>
      </div>

      <div className="space-y-2">
        {visibleResults.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            {t("github.filterStartsWithEmpty")}
          </div>
        ) : (
          visibleResults.map((repo) => {
            const existing = importedByRepoUrl.get(normalizeRepoUrl(repo.html_url));
            return (
              <GithubRepoCard
                key={repo.id}
                repo={repo}
                selected={selected.has(repo.id)}
                alreadyImported={Boolean(existing)}
                hasDefectDojoConflict={
                  existing
                    ? normalizeSources(existing).some(
                        (source) => source.type === ServiceSource.Defectdojo,
                      )
                    : false
                }
                onToggle={onToggleSelect}
              />
            );
          })
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {results.length < totalCount && (
          <Button
            type="button"
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {t("github.loadMore")}
          </Button>
        )}

        <Button
          type="button"
          onClick={onImport}
          disabled={selectedCount === 0 || loading}
        >
          {t("github.importSelectedCount", { count: selectedCount })}
        </Button>
      </div>
    </div>
  );
}
