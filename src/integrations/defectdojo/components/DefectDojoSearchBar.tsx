import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { DDProductType } from "../types";
import {
  DD_PRODUCT_SEARCH_FIELDS,
  type DDProductSearchField,
} from "../defectdojo.service";
import { useTranslation } from "react-i18next";

interface Props {
  productTypes: DDProductType[];
  loading: boolean;
  onSearch: (
    query: string,
    filters: { prodType?: number; searchField?: DDProductSearchField; limit?: number },
  ) => void;
}

export function DefectDojoSearchBar({
  productTypes,
  loading,
  onSearch,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [prodType, setProdType] = useState<string>("");
  const [limit, setLimit] = useState("100");
  const [searchField, setSearchField] = useState<DDProductSearchField>(
    DD_PRODUCT_SEARCH_FIELDS[0].param as DDProductSearchField,
  );

  const handleSearch = () => {
    onSearch(query, {
      prodType: prodType ? Number(prodType) : undefined,
      searchField,
      limit: Number(limit),
    });
  };

  const currentField = DD_PRODUCT_SEARCH_FIELDS.find(
    (f) => f.param === searchField,
  );
  const fieldLabel = currentField
    ? t(`defectdojo.productSearchField.${currentField.param}`)
    : "";
  const placeholder = currentField
    ? t("defectdojo.searchByField", { field: fieldLabel.toLowerCase() })
    : t("defectdojo.searchProduct");

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
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <select
        value={searchField}
        onChange={(e) => setSearchField(e.target.value as DDProductSearchField)}
        className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {DD_PRODUCT_SEARCH_FIELDS.map((f) => (
          <option key={f.param} value={f.param}>
            {t(`defectdojo.productSearchField.${f.param}`)}
          </option>
        ))}
      </select>

      {productTypes.length > 0 && (
        <select
          value={prodType}
          onChange={(e) => setProdType(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">{t("defectdojo.allProductTypes")}</option>
          {productTypes.map((pt) => (
            <option key={pt.id} value={String(pt.id)}>
              {pt.name}
            </option>
          ))}
        </select>
      )}

      <select
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {[50, 100, 150, 200, 250].map((n) => (
          <option key={n} value={String(n)}>
            {t("defectdojo.limitResults", { n })}
          </option>
        ))}
      </select>

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
        {t("defectdojo.searchButton")}
      </button>
    </div>
  );
}
