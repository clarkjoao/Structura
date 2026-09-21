/**
 * API calls for ASL Upstream.
 */

import { UPSTREAM_API_BASE } from "../config";

export async function fetchNamespaces(): Promise<string[]> {
  const response = await fetch(`${UPSTREAM_API_BASE}/namespaces/dev`);
  if (!response.ok) {
    throw new Error(`Failed to fetch namespaces: ${response.statusText}`);
  }
  const data = await response.json();
  return data.namespaces ?? [];
}

export async function fetchDiagramUrls(
  namespace: string,
): Promise<Record<string, string>> {
  const response = await fetch(`${UPSTREAM_API_BASE}/diagrams/${namespace}/url`);
  if (!response.ok) {
    throw new Error(`Failed to fetch diagram URLs: ${response.statusText}`);
  }
  const data = await response.json();
  return data.url ?? {};
}

export async function fetchDiagramJson(
  signedUrl: string,
): Promise<unknown> {
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch diagram: ${response.statusText}`);
  }
  return response.json();
}
