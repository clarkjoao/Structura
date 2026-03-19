import type { DefectDojoClient } from "./defectdojo.client";
import type { DDProduct, DDProductType, DDUser } from "./types";
import type { ServiceDefinition } from "@/features/diagram";

interface PaginatedResponse<T> {
  count: number;
  results: T[];
}

/**
 * Todos os parâmetros de busca suportados pela API de produtos do DefectDojo.
 * Inclui campos padrão do modelo Product + sigla/siglaApp (custom).
 * @see https://defectdojo.github.io/django-DefectDojo/integrations/api-v2-docs/
 */
export const DD_PRODUCT_SEARCH_FIELDS = [
  { param: "sigla", label: "Sigla" },
  { param: "siglaApp", label: "Sigla App" },
  { param: "name__icontains", label: "Nome (contém)" },
  { param: "name", label: "Nome (exato)" },
  { param: "id", label: "ID" },
] as const;

export type DDProductSearchField =
  (typeof DD_PRODUCT_SEARCH_FIELDS)[number]["param"];

export async function searchProducts(
  client: DefectDojoClient,
  query: string,
  filters: {
    prodType?: number;
    limit?: number;
    searchField?: DDProductSearchField;
  },
): Promise<DDProduct[]> {
  const params: Record<string, string> = {
    limit: String(filters.limit ?? 100),
  };

  const field = filters.searchField ?? "name__icontains";
  if (query) {
    params[field] = query;
  }

  if (filters.prodType !== undefined) {
    params.prod_type = String(filters.prodType);
  }

  const data = await client.get<PaginatedResponse<DDProduct>>(
    "/products/",
    params,
  );
  return data.results;
}

export async function getProductTypes(
  client: DefectDojoClient,
): Promise<DDProductType[]> {
  const data = await client.get<PaginatedResponse<DDProductType>>(
    "/product_types/",
    { limit: "100" },
  );
  return data.results;
}

export async function getCurrentUser(
  client: DefectDojoClient,
): Promise<DDUser> {
  return client.get<DDUser>("/users/me/");
}

export function mapToServiceDefinition(
  product: DDProduct,
): Omit<ServiceDefinition, "id"> {
  return {
    name: product.name,
    description: product.description || "",
    repositoryUrl: product?.metadata?.repositoryUrl as string ?? "",
    technology: [],
    tags: product.tags || [],
    source: "defectdojo",
    sourceId: String(product.id),
    metadata: {
      defectdojo: {
        businessCriticality: product.business_criticality,
        platform: product.platform,
        lifecycle: product.lifecycle,
        prodType: product.prod_type?.name,
      },
    },
  };
}
