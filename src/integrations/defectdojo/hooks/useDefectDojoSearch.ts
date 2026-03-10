import { useState, useCallback } from "react";
import { useDiagramStore } from "@/features/diagram";
import { DefectDojoClient } from "../defectdojo.client";
import {
  searchProducts,
  getProductTypes,
  type DDProductSearchField,
} from "../defectdojo.service";
import type {
  DefectDojoConfig,
  DDSearchResult,
  DDProductType,
  ImportStatus,
} from "../types";

function resolveImportStatus(
  productId: number,
  productName: string,
  productDesc: string,
): { status: ImportStatus; existingServiceId?: string } {
  const state = useDiagramStore.getState();
  const allServices = Object.values(state.diagrams).flatMap((d) =>
    Object.values(d.snapshot.serviceRegistry ?? {}),
  );
  const existing = allServices.find(
    (s) => s.source === "defectdojo" && s.sourceId === String(productId),
  );
  if (!existing) return { status: "not-imported" };
  if (existing.name === productName && existing.description === productDesc) {
    return { status: "imported", existingServiceId: existing.id };
  }
  return { status: "updated", existingServiceId: existing.id };
}

export function useDefectDojoSearch(config: DefectDojoConfig | null) {
  const [results, setResults] = useState<DDSearchResult[]>([]);
  const [productTypes, setProductTypes] = useState<DDProductType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (
      query: string,
      filters: { prodType?: number; searchField?: DDProductSearchField },
    ) => {
      if (!config) return;
      setLoading(true);
      setError(null);
      try {
        const client = new DefectDojoClient(config);
        const products = await searchProducts(client, query, filters);
        const withStatus: DDSearchResult[] = products.map((p) => {
          const { status, existingServiceId } = resolveImportStatus(
            p.id,
            p.name,
            p.description,
          );
          return { ...p, status, existingServiceId };
        });
        setResults(withStatus);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao buscar produtos",
        );
      } finally {
        setLoading(false);
      }
    },
    [config],
  );

  const loadProductTypes = useCallback(async () => {
    if (!config) return;
    try {
      const client = new DefectDojoClient(config);
      const types = await getProductTypes(client);
      setProductTypes(types);
    } catch {
      // non-critical — filter simply won't show options
    }
  }, [config]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  const refreshStatuses = useCallback(() => {
    setResults((prev) =>
      prev.map((p) => {
        const { status, existingServiceId } = resolveImportStatus(
          p.id,
          p.name,
          p.description,
        );
        return { ...p, status, existingServiceId };
      }),
    );
  }, []);

  return {
    results,
    productTypes,
    loading,
    error,
    search,
    clearResults,
    loadProductTypes,
    refreshStatuses,
  };
}
