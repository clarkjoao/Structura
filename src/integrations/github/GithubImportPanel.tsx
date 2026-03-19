import type { MergeResolution } from "./GithubMergeDialog";
import { GithubMergeDialog } from "./GithubMergeDialog";
import { GithubSearchBar } from "./GithubSearchBar";
import { GithubResultsList } from "./GithubResultsList";
import { useAllServices } from "@/features/diagram";
import { useGithubImport } from "./useGithubImport";

export function GithubImportPanel() {
  const {
    client,
    results,
    selected,
    loading,
    error,
    totalCount,
    conflicts,
    nameStartsFilter,
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

  const handleResolve = (resolutions: MergeResolution[]) => {
    void resolveConflicts(resolutions);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">GitHub Search</h2>

      <GithubSearchBar loading={loading} client={client} onSearch={search} />

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <GithubResultsList
        results={results}
        selected={selected}
        totalCount={totalCount}
        loading={loading}
        allServices={allServices}
        nameStartsFilter={nameStartsFilter}
        onToggleSelect={toggleSelect}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onLoadMore={() => void loadMore()}
        onImport={() => void importSelected()}
      />

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
