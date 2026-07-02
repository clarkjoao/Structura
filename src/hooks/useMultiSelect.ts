import { useCallback, useState } from "react";

export interface UseMultiSelectResult {
  selectedIds: ReadonlySet<string>;
  toggleSelect: (id: string, isMulti: boolean) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export function useMultiSelect(): UseMultiSelectResult {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

  const toggleSelect = useCallback((id: string, isMulti: boolean) => {
    setSelectedIds((previous) => {
      if (!isMulti) {
        return new Set([id]);
      }
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    toggleSelect,
    clearSelection,
    isSelected,
  };
}
