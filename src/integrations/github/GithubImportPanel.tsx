import { useMemo, useState } from "react";
import { Archive, ExternalLink, Search as SearchIcon } from "lucide-react";
import type { MergeResolution } from "./GithubMergeDialog";
import { GithubMergeDialog } from "./GithubMergeDialog";
import { useAllServices } from "@/features/diagram";
import { useGithubImport } from "./useGithubImport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

function truncateTopics(topics: string[], max = 3) {
  return topics.slice(0, max);
}

export function GithubImportPanel() {
  const {
    query,
    setQuery,
    results,
    selected,
    loading,
    error,
    totalCount,
    conflicts,
    search,
    loadMore,
    toggleSelect,
    selectAll,
    clearSelection,
    importSelected,
    cancelConflicts,
    resolveConflicts,
  } = useGithubImport();

  const allServices = useAllServices();
  const importedByRepoUrl = useMemo(() => {
    const map = new Map<string, (typeof allServices)[number]>();
    for (const svc of allServices) {
      if (!svc.repositoryUrl) continue;
      map.set(svc.repositoryUrl, svc);
    }
    return map;
  }, [allServices]);

  const [hideArchived, setHideArchived] = useState(true);
  const [language, setLanguage] = useState<string>("all");
  const [nameFilter, setNameFilter] = useState("");

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      if (r.language) set.add(r.language);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [results]);

  const visibleResults = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    return results.filter((r) => {
      if (hideArchived && r.archived) return false;
      if (language !== "all" && r.language !== language) return false;
      if (q) {
        const hay = `${r.name} ${r.full_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [results, hideArchived, language, nameFilter]);

  const selectedCount = selected.size;

  const handleResolve = (resolutions: MergeResolution[]) => {
    void resolveConflicts(resolutions);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">GitHub Search</h2>
            <Badge variant="secondary" className="bg-secondary/70">
              {totalCount} resultado{totalCount !== 1 ? "s" : ""}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ex: org:minha-org+in:name, kotlin+in:topics"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => search(query)}
              disabled={loading || !query.trim()}
              className="shrink-0"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <SearchIcon className="h-4 w-4 animate-spin" />
                  Buscando...
                </span>
              ) : (
                <>
                  <SearchIcon className="h-4 w-4" />
                  Buscar
                </>
              )}
            </Button>
          </div>

          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
            <a
              href="https://docs.github.com/en/rest/search/search"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Docs da Search API
            </a>
            <ExternalLink className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      {/* Local filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Switch checked={hideArchived} onCheckedChange={setHideArchived} />
          <span className="text-sm text-muted-foreground">Ocultar arquivados</span>
        </div>

        <div className="min-w-[220px]">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione linguagem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as linguagens</SelectItem>
              {languages.map((l) => (
                <SelectItem value={l} key={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[240px]">
          <Input
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filtro por nome"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Button type="button" size="sm" variant="outline" onClick={selectAll} disabled={results.length === 0}>
          Selecionar tudo
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={clearSelection} disabled={selectedCount === 0}>
          Limpar
        </Button>
      </div>

      <div className="space-y-2">
        {visibleResults.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            Nenhum repositório corresponde aos filtros atuais.
          </div>
        ) : (
          visibleResults.map((repo) => {
            const isSelected = selected.has(repo.id);
            const existing = importedByRepoUrl.get(repo.html_url);
            const alreadyImported = Boolean(existing);
            const hasDefectDojoConflict =
              existing?.source === "defectdojo";

            return (
              <div
                key={repo.id}
                className={`rounded-xl border border-border bg-card p-3 flex items-start gap-3 ${
                  isSelected ? "ring-1 ring-primary/30" : ""
                }`}
              >
                <div className="pt-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(repo.id)}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-foreground truncate">
                        {repo.name}
                      </p>
                      {repo.archived && (
                        <div className="mt-1 inline-flex items-center gap-2">
                          <Badge
                            className="bg-secondary/70 text-muted-foreground border border-border"
                          >
                            <Archive className="h-3.5 w-3.5 mr-1" />
                            Arquivado
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {alreadyImported && (
                        <Badge
                          className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        >
                          Já importado
                        </Badge>
                      )}
                      {hasDefectDojoConflict && (
                        <Badge
                          className="bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        >
                          Conflito DefectDojo
                        </Badge>
                      )}
                    </div>
                  </div>

                  {repo.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {repo.description}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                    {repo.language && (
                      <Badge
                        variant="secondary"
                        className="bg-secondary/70 text-secondary-foreground"
                      >
                        {repo.language}
                      </Badge>
                    )}
                    {truncateTopics(repo.topics).map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="border-border text-muted-foreground rounded-full"
                      >
                        {t}
                      </Badge>
                    ))}
                    {repo.topics.length > 3 && (
                      <Badge className="bg-secondary/70 text-muted-foreground border border-border">
                        +{repo.topics.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
        </div>

        <div className="flex items-center gap-2">
          {results.length < totalCount && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadMore()}
              disabled={loading}
            >
              Carregar mais
            </Button>
          )}

          <Button
            type="button"
            onClick={() => void importSelected()}
            disabled={selectedCount === 0 || loading}
          >
            Importar selecionados
          </Button>
        </div>
      </div>

      {conflicts && (
        <GithubMergeDialog
          conflicts={conflicts}
          onResolve={handleResolve}
          onCancel={cancelConflicts}
        />
      )}
    </div>
  );
}

