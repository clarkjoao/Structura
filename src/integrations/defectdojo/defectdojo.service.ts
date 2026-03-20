import type { DefectDojoClient } from "./defectdojo.client";
import type { DDProduct, DDProductType, DDUser } from "./types";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";

interface PaginatedResponse<T> {
  count: number;
  results: T[];
}

/**
 * Todos os parâmetros de busca suportados pela API de produtos do DefectDojo.
 * Inclui campos padrão do modelo Product + sigla/siglaApp (custom).
 * @see https://defectdojo.github.io/django-DefectDojo/integrations/api-v2-docs/
 */
/** Field keys — labels from `defectdojo.productSearchField.*` in i18n */
export const DD_PRODUCT_SEARCH_FIELDS = [
  { param: "sigla" as const },
  { param: "siglaApp" as const },
  { param: "name__icontains" as const },
  { param: "name" as const },
  { param: "id" as const },
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

const DEFECTDOJO_CONFIG_KEY = "structura_defectdojo:config";
const DEFECTDOJO_CONFIG_LEGACY_KEY = "structura:defectdojo:config";

function getStoredDefectDojoBaseUrl(): string {
  try {
    const raw =
      localStorage.getItem(DEFECTDOJO_CONFIG_KEY) ??
      localStorage.getItem(DEFECTDOJO_CONFIG_LEGACY_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { baseUrl?: string };
    return (parsed.baseUrl ?? "").replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function buildDefectDojoProductLink(
  productId: number | string,
  baseUrl?: string,
): string {
  const normalizedBase = (baseUrl ?? getStoredDefectDojoBaseUrl()).replace(
    /\/+$/,
    "",
  );
  if (!normalizedBase) return "";
  return `${normalizedBase}/product/${productId}`;
}

export function mapToServiceDefinition(
  product: DDProduct,
): Omit<ServiceDefinition, "id"> {
  const productLink = buildDefectDojoProductLink(product.id);
  return {
    name: product.name,
    description: product.description || "",
    repositoryUrl: product?.metadata?.repositoryUrl as string ?? "",
    technology: [],
    tags: product.tags || [],
    sources: [{ type: ServiceSource.Defectdojo, sourceId: String(product.id) }],
    metadata: {
      defectdojo: {
        productId: product.id,
        productLink,
        businessCriticality: product.business_criticality,
        platform: product.platform,
        lifecycle: product.lifecycle,
        prodType: product.prod_type?.name,
      },
    },
  };
}
