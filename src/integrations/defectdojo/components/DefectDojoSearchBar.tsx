import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { DDProductType } from "../types";

interface Props {
  productTypes: DDProductType[];
  loading: boolean;
  onSearch: (query: string, filters: { prodType?: number }) => void;
}

export function DefectDojoSearchBar({ productTypes, loading, onSearch }: Props) {
  const [query, setQuery] = useState("");
  const [prodType, setProdType] = useState<string>("");

  const handleSearch = () => {
    onSearch(query, {
      prodType: prodType ? Number(prodType) : undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por nome do produto..."
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {productTypes.length > 0 && (
        <select
          value={prodType}
          onChange={(e) => setProdType(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todos os tipos</option>
          {productTypes.map((pt) => (
            <option key={pt.id} value={String(pt.id)}>
              {pt.name}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={handleSearch}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        Buscar
      </button>
    </div>
  );
}
