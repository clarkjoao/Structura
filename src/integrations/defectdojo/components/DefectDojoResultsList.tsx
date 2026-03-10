import { useState, useCallback } from "react";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { useDiagramStore } from "@/features/diagram";
import { mapToServiceDefinition } from "../defectdojo.service";
import type { DDSearchResult } from "../types";
import { DefectDojoProductCard } from "./DefectDojoProductCard";

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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const selectableIds = results
    .filter((r) => r.status !== "imported")
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
      if (product.status === "updated" && product.existingServiceId) {
        store.updateService(product.existingServiceId, svcData);
        updatedCount++;
      } else {
        store.addService(svcData);
        importedCount++;
      }
    }

    setSelected(new Set());
    onRefreshStatuses();

    const parts: string[] = [];
    if (importedCount > 0)
      parts.push(`${importedCount} serviço${importedCount > 1 ? "s" : ""} importado${importedCount > 1 ? "s" : ""}`);
    if (updatedCount > 0)
      parts.push(`${updatedCount} atualizado${updatedCount > 1 ? "s" : ""}`);
    setImportMessage(parts.join(" e ") + " com sucesso");
    setTimeout(() => setImportMessage(null), 4000);
  };

  const importedCount = results.filter((r) => r.status === "imported").length;

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
          Tentar novamente
        </button>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Busque produtos acima para importar.
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
            Selecionar todos
          </label>
          <span className="text-xs text-muted-foreground">
            {results.length} resultado{results.length !== 1 ? "s" : ""}
            {importedCount > 0 && ` · ${importedCount} já importado${importedCount !== 1 ? "s" : ""}`}
          </span>
        </div>

        <button
          onClick={handleImport}
          disabled={selected.size === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          Importar selecionados ({selected.size})
        </button>
      </div>

      {importMessage && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">
          ✓ {importMessage}
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
