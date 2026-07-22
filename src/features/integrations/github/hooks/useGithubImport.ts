import { useCallback, useMemo, useRef, useState } from "react";
import type { GithubRepo, GHSearchFilters } from "../github.types";
import { buildGithubQuery } from "../github.types";
import { createGithubClient } from "../githubClient";
import type { MergeConflict } from "../detectMergeConflicts";
import type { MergeResolution } from "../github-merge.types";
import { useAllServices, useRegistryActions } from "@/features/diagram";
import { useGithubConfig } from "./useGithubConfig";
import { i18n } from "@/infrastructure/i18n";
import { buildGithubImportPlan } from "../application/buildGithubImportPlan";
import { executeGithubImportPlan } from "../application/executeGithubImportPlan";

const DEFAULT_PER_PAGE = 50;

export function useGithubImport() {
  const { config } = useGithubConfig();
  const allServices = useAllServices();
  const { addService, updateService } = useRegistryActions();

  const client = useMemo(() => {
    if (!config?.baseUrl || !config?.token) return null;
    return createGithubClient({
      baseUrl: config.baseUrl,
      token: config.token,
      useProxy: config.useProxy,
      proxyUrl: config.useProxy ? config.proxyUrl : undefined,
    });
  }, [config]);

  const [results, setResults] = useState<GithubRepo[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [conflicts, setConflicts] = useState<MergeConflict[] | null>(null);
  const [allConflictsForImport, setAllConflictsForImport] = useState<MergeConflict[]>([]);
  const [autoResolutions, setAutoResolutions] = useState<MergeResolution[]>([]);

  const [nameStartsFilter, setNameStartsFilter] = useState<string | undefined>(undefined);

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

      setNameStartsFilter(filters.searchField === "name_starts" ? query.trim() : undefined);

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
      const res = await client.searchRepositories(
        lastBuiltQuery.current,
        nextPage,
        lastPerPage.current,
      );
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
      const plan = buildGithubImportPlan({ selectedRepos, allServices });
      setAllConflictsForImport(plan.conflictsForImport);
      setAutoResolutions(plan.autoResolutions);

      if (plan.crossConflicts.length > 0) {
        setConflicts(plan.crossConflicts);
      } else {
        await executeGithubImportPlan({
          selectedRepos,
          plan,
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
        await executeGithubImportPlan({
          selectedRepos,
          plan: {
            conflictsForImport: allConflictsForImport,
            crossConflicts: [],
            autoResolutions,
          },
          userResolutions: resolutions,
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
    [addService, updateService, allConflictsForImport, autoResolutions, results, selected],
  );

  const resolveConflicts = useCallback(
    async (userResolutions: MergeResolution[]) => {
      await commitImport(userResolutions);
    },
    [commitImport],
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
