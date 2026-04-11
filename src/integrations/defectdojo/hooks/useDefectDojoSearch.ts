import { useState, useCallback } from "react";
import { useDiagramStore, ServiceSource } from "@/features/diagram";
import { DefectDojoImportStatus } from "../enums";
import { normalizeSources } from "@/integrations/merge-utils";
import { DefectDojoClient } from "../defectdojo.client";
import {
  searchProducts,
  getProductTypes,
  type DDProductSearchField,
} from "../defectdojo.service";
import { i18n } from "@/infrastructure/i18n";
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
  const allServices = Object.values(state.serviceRegistry);
  const existing = allServices.find(
    (service) =>
      normalizeSources(service).some(
        (source) =>
          source.type === ServiceSource.Defectdojo && source.sourceId === String(productId),
      ),
  );
  if (!existing) return { status: DefectDojoImportStatus.NotImported };
  if (existing.name === productName && existing.description === productDesc) {
    return { status: DefectDojoImportStatus.Imported, existingServiceId: existing.id };
  }
  return { status: DefectDojoImportStatus.Updated, existingServiceId: existing.id };
}

export function useDefectDojoSearch(config: DefectDojoConfig | null) {
  const [results, setResults] = useState<DDSearchResult[]>([]);
  const [productTypes, setProductTypes] = useState<DDProductType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (
      query: string,
      filters: { prodType?: number; searchField?: DDProductSearchField; limit?: number },
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
          err instanceof Error ? err.message : i18n.t("defectdojo.searchError"),
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
