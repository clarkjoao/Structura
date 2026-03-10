import type { DefectDojoClient } from "./defectdojo.client";
import type { DDProduct, DDProductType, DDUser } from "./types";
import type { ServiceDefinition } from "@/features/registry";

interface PaginatedResponse<T> {
  count: number;
  results: T[];
}

export async function searchProducts(
  client: DefectDojoClient,
  query: string,
  filters: { prodType?: number; limit?: number },
): Promise<DDProduct[]> {
  const params: Record<string, string> = {
    name__icontains: query,
    limit: String(filters.limit ?? 50),
  };
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
    repositoryUrl: "",
    technology: [],
    tags: product.tags || [],
    source: "defectdojo",
    sourceId: String(product.id),
    metadata: {
      businessCriticality: product.business_criticality,
      platform: product.platform,
      lifecycle: product.lifecycle,
      prodType: product.prod_type?.name,
    },
  };
}
