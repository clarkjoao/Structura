export interface DDProduct {
  id: number;
  name: string;
  description: string;
  tags: string[];
  business_criticality?: string;
  platform?: string;
  lifecycle?: string;
  origin?: string;
  prod_type?: { id: number; name: string };
}

export interface DDProductType {
  id: number;
  name: string;
}

export interface DDUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

export interface DefectDojoConfig {
  baseUrl: string;
  apiToken: string;
}

export type ImportStatus = "not-imported" | "imported" | "updated";

export interface DDSearchResult extends DDProduct {
  status: ImportStatus;
  existingServiceId?: string;
}
