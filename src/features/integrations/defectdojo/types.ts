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
  metadata?: Record<string, unknown>;
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
  /** Use the dev proxy server instead of direct API calls (for corporate networks with CORS restrictions) */
  useProxy?: boolean;
  /** Custom proxy URL (defaults to http://localhost:3000/proxy) */
  proxyUrl?: string;
}

import type { DefectDojoImportStatus } from "./enums";

export type ImportStatus = DefectDojoImportStatus;

export interface DDSearchResult extends DDProduct {
  status: DefectDojoImportStatus;
  existingServiceId?: string;
}
