import { useCallback, useMemo, useState } from "react";
import type { GithubRepo } from "./github.types";
import { createGithubClient } from "./githubClient";
import { detectConflicts } from "./detectMergeConflicts";
import type { MergeConflict } from "./detectMergeConflicts";
import type { MergeResolution } from "./GithubMergeDialog";
import { useAllServices, useRegistryActions } from "@/features/diagram";
import { useGithubConfig } from "./useGithubConfig";
import { commitGithubImport } from "./github.service";

const PER_PAGE = 20;

export function useGithubImport() {
  const { config } = useGithubConfig();
  const allServices = useAllServices();
  const { addService, updateService } = useRegistryActions();

  const client = useMemo(() => {
    if (!config?.baseUrl || !config?.token) return null;
    return createGithubClient(config.baseUrl, config.token);
  }, [config]);

  const [query, setQuery] = useState("");
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

  const clearAll = useCallback(() => {
    setResults([]);
    setSelected(new Set());
    setPage(1);
    setTotalCount(0);
    setConflicts(null);
    setAllConflictsForImport([]);
    setAutoResolutions([]);
    setError("");
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (!client) {
        setError("GitHub não configurado. Conecte primeiro nas configurações.");
        return;
      }

      const trimmed = q.trim();
      setQuery(trimmed);
      setLoading(true);
      setError("");
      setPage(1);
      setConflicts(null);
      setSelected(new Set());

      try {
        const res = await client.searchRepositories(trimmed, 1, PER_PAGE);
        setResults(res.items);
        setTotalCount(res.total_count);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao buscar repositórios");
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
      const res = await client.searchRepositories(query, nextPage, PER_PAGE);
      setResults((prev) => [...prev, ...res.items]);
      setPage(nextPage);
      setTotalCount(res.total_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mais");
    } finally {
      setLoading(false);
    }
  }, [client, loading, page, results.length, totalCount, query]);

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
      setError("GitHub não configurado. Conecte primeiro nas configurações.");
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
        if (c.existingService.source === "defectdojo") return 3;
        if (c.existingService.source === "github") return 2;
        return 1;
      };

      for (const c of detectedAll) {
        const prev = bestByRepoId.get(c.repo.id);
        if (!prev || score(c) > score(prev)) bestByRepoId.set(c.repo.id, c);
      }

      const bestConflictsForImport = Array.from(bestByRepoId.values());
      setAllConflictsForImport(bestConflictsForImport);

      const githubExistingConflicts = bestConflictsForImport.filter(
        (c) => c.existingService.source === "github",
      );
      const crossConflicts = bestConflictsForImport.filter(
        (c) => c.existingService.source !== "github",
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
      setError(err instanceof Error ? err.message : "Erro ao importar");
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
        setError(err instanceof Error ? err.message : "Erro ao confirmar importação");
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
    query,
    setQuery,
    results,
    selected,
    loading,
    error,
    page,
    totalCount,
    conflicts,
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

