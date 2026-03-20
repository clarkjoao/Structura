import { useCallback, useMemo, useRef, useState } from "react";
import type { GithubRepo, GHSearchFilters } from "../github.types";
import { buildGithubQuery } from "../github.types";
import { createGithubClient } from "../githubClient";
import { detectConflicts } from "../detectMergeConflicts";
import type { MergeConflict } from "../detectMergeConflicts";
import type { MergeResolution } from "../components/GithubMergeDialog";
import { useAllServices, useRegistryActions } from "@/features/diagram";
import { useGithubConfig } from "./useGithubConfig";
import { commitGithubImport } from "../github.service";
import { normalizeSources } from "../../merge-utils";
import { i18n } from "@/infrastructure/i18n";

const DEFAULT_PER_PAGE = 50;

export function useGithubImport() {
  const { config } = useGithubConfig();
  const allServices = useAllServices();
  const { addService, updateService } = useRegistryActions();

  const client = useMemo(() => {
    if (!config?.baseUrl || !config?.token) return null;
    return createGithubClient(config.baseUrl, config.token);
  }, [config]);

  const [results, setResults] = useState<GithubRepo[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [conflicts, setConflicts] = useState<MergeConflict[] | null>(null);
  const [allConflictsForImport, setAllConflictsForImport] = useState<
    MergeConflict[]
  >([]);
  const [autoResolutions, setAutoResolutions] = useState<
    MergeResolution[]
  >([]);
  /** Pós-filtragem client-side para "inicia com" */
  const [nameStartsFilter, setNameStartsFilter] = useState<string | undefined>(
    undefined,
  );

  /** Guarda a última query montada e perPage para paginação */
  const lastBuiltQuery = useRef("");
  const lastPerPage = useRef(DEFAULT_PER_PAGE);

  const clearAll = useCallback(() => {
    setResults([]);
    setSelected(new Set());
    setPage(1);
    setTotalCount(0);
    setConflicts(null);
    setAllConflictsForImport([]);
    setAutoResolutions([]);
    setError("");
    setNameStartsFilter(undefined);
    lastBuiltQuery.current = "";
  }, []);

  const search = useCallback(
    async (query: string, filters: GHSearchFilters) => {
      if (!client) {
        setError(i18n.t("github.notConfigured"));
        return;
      }

      const builtQuery = buildGithubQuery(query, filters);
      if (!builtQuery.trim()) {
        setError(i18n.t("github.enterSearch"));
        return;
      }

      lastBuiltQuery.current = builtQuery;
      const perPage = filters.perPage ?? DEFAULT_PER_PAGE;
      lastPerPage.current = perPage;

      // "inicia com" usa pós-filtragem client-side
      setNameStartsFilter(
        filters.searchField === "name_starts" ? query.trim() : undefined,
      );

      setLoading(true);
      setError("");
      setPage(1);
      setConflicts(null);
      setSelected(new Set());

      try {
        const res = await client.searchRepositories(builtQuery, 1, perPage);
        setResults(res.items);
        setTotalCount(res.total_count);
      } catch (err) {
        setError(err instanceof Error ? err.message : i18n.t("github.searchError"));
        setResults([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const loadMore = useCallback(async () => {
    if (!client) return;
    if (loading) return;
    const nextPage = page + 1;
    if (results.length >= totalCount) return;

    setLoading(true);
    setError("");
    try {
      const res = await client.searchRepositories(lastBuiltQuery.current, nextPage, lastPerPage.current);
      setResults((prev) => [...prev, ...res.items]);
      setPage(nextPage);
      setTotalCount(res.total_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("github.loadMoreError"));
    } finally {
      setLoading(false);
    }
  }, [client, loading, page, results.length, totalCount]);

  const toggleSelect = useCallback((repoId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) next.delete(repoId);
      else next.add(repoId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected((_) => new Set(results.map((r) => r.id)));
  }, [results]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const cancelConflicts = useCallback(() => {
    setConflicts(null);
    setAllConflictsForImport([]);
    setAutoResolutions([]);
  }, []);

  const importSelected = useCallback(async () => {
    if (selected.size === 0) return;
    if (!client) {
      setError(i18n.t("github.notConfigured"));
      return;
    }

    const selectedRepos = results.filter((r) => selected.has(r.id));
    if (selectedRepos.length === 0) return;

    setLoading(true);
    setError("");
    try {
      const detectedAll = detectConflicts(selectedRepos, allServices);

      // If multiple services match the same repo URL, pick a single merge target.
      // For GitHub import, DefectDojo service has priority.
      const bestByRepoId = new Map<number, MergeConflict>();
      const score = (c: MergeConflict) => {
        const sources = normalizeSources(c.existingService);
        if (sources.some((source) => source.type === "defectdojo")) return 3;
        if (sources.some((source) => source.type === "github")) return 2;
        return 1;
      };

      for (const c of detectedAll) {
        const prev = bestByRepoId.get(c.repo.id);
        if (!prev || score(c) > score(prev)) bestByRepoId.set(c.repo.id, c);
      }

      const bestConflictsForImport = Array.from(bestByRepoId.values());
      setAllConflictsForImport(bestConflictsForImport);

      const githubExistingConflicts = bestConflictsForImport.filter(
        (c) =>
          normalizeSources(c.existingService).some(
            (source) => source.type === "github",
          ),
      );
      const crossConflicts = bestConflictsForImport.filter(
        (c) =>
          !normalizeSources(c.existingService).some(
            (source) => source.type === "github",
          ),
      );

      const autoRes: MergeResolution[] = githubExistingConflicts.map((c) => ({
        existingServiceId: c.existingService.id,
        fields: {
          name: "github",
          description: "github",
          technology: "merge",
          tags: "merge",
        },
      }));

      setAutoResolutions(autoRes);

      if (crossConflicts.length > 0) {
        setConflicts(crossConflicts);
      } else {
        await commitGithubImport({
          selectedRepos,
          conflictsForImport: bestConflictsForImport,
          resolutions: autoRes,
          addService,
          updateService,
        });
        setConflicts(null);
        setSelected(new Set());
        setAllConflictsForImport([]);
        setAutoResolutions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("github.importError"));
    } finally {
      setLoading(false);
    }
  }, [selected, results, client, allServices, addService, updateService]);

  const commitImport = useCallback(
    async (resolutions: MergeResolution[]) => {
      const selectedRepos = results.filter((r) => selected.has(r.id));
      if (selectedRepos.length === 0) return;

      setLoading(true);
      setError("");
      try {
        await commitGithubImport({
          selectedRepos,
          conflictsForImport: allConflictsForImport,
          resolutions,
          addService,
          updateService,
        });

        setConflicts(null);
        setSelected(new Set());
        setAllConflictsForImport([]);
        setAutoResolutions([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : i18n.t("github.confirmImportError"));
      } finally {
        setLoading(false);
      }
    },
    [addService, updateService, allConflictsForImport, results, selected],
  );

  const resolveConflicts = useCallback(
    async (userResolutions: MergeResolution[]) => {
      await commitImport([...autoResolutions, ...userResolutions]);
    },
    [autoResolutions, commitImport],
  );

  return {
    client,
    results,
    selected,
    loading,
    error,
    page,
    totalCount,
    conflicts,
    nameStartsFilter,
    search,
    loadMore,
    toggleSelect,
    selectAll,
    clearSelection,
    importSelected,
    commitImport,
    cancelConflicts,
    clearAll,
    resolveConflicts,
  };
}
