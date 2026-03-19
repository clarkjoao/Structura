import { useMemo } from "react";
import type { GithubRepo } from "./github.types";
import type { ServiceDefinition } from "@/features/diagram";
import { GithubRepoCard } from "./GithubRepoCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const importedByRepoUrl = useMemo(() => {
    const map = new Map<string, ServiceDefinition>();
    for (const svc of allServices) {
      if (!svc.repositoryUrl) continue;
      map.set(svc.repositoryUrl, svc);
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
        Nenhum repositório encontrado. Use a barra de busca acima.
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
            Selecionar tudo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onClearSelection}
            disabled={selectedCount === 0}
          >
            Limpar
          </Button>
          <Badge variant="secondary" className="bg-secondary/70">
            {totalCount} resultado{totalCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="text-sm text-muted-foreground">
          {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="space-y-2">
        {visibleResults.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            Nenhum repositório corresponde ao filtro "inicia com".
          </div>
        ) : (
          visibleResults.map((repo) => {
            const existing = importedByRepoUrl.get(repo.html_url);
            return (
              <GithubRepoCard
                key={repo.id}
                repo={repo}
                selected={selected.has(repo.id)}
                alreadyImported={Boolean(existing)}
                hasDefectDojoConflict={existing?.source === "defectdojo"}
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
            Carregar mais
          </Button>
        )}

        <Button
          type="button"
          onClick={onImport}
          disabled={selectedCount === 0 || loading}
        >
          Importar selecionados ({selectedCount})
        </Button>
      </div>
    </div>
  );
}
