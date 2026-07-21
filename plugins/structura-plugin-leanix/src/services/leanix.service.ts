/**
 * Leanix API Service
 */
import type { LeanixConfig } from "../types/config";

interface LeanixBookmark {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Decode JWT token and extract principal.id
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    // Remove "Bearer " prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
    const parts = cleanToken.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload.principal?.id || payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Ensure token has "Bearer " prefix
 */
export function ensureBearerPrefix(token: string): string {
  const cleanToken = token.trim();
  if (cleanToken.toLowerCase().startsWith("bearer ")) {
    return cleanToken;
  }
  return `Bearer ${cleanToken}`;
}

async function apiRequest(config: LeanixConfig, path: string, options: RequestInit = {}): Promise<Response> {
  const targetPath = path.startsWith("/") ? path : `/${path}`;
  const targetUrl = `${config.baseUrl.replace(/\/$/, "")}${targetPath}`;

  const url = config.useProxy
    ? `${config.proxyUrl.replace(/\/$/, "")}?url=${encodeURIComponent(targetUrl)}`
    : targetUrl;

  // Ensure Bearer prefix is present
  const authHeader = ensureBearerPrefix(config.authToken);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader,
      accept: "application/json",
      ...options.headers,
    },
  });
  return response;
}

async function createDiagram(config: LeanixConfig, name: string, graphXml: string, userId: string): Promise<LeanixBookmark> {
  const payload = {
    type: "VISUALIZER",
    name,
    description: "",
    groupKey: "freedraw",
    state: { graphXml, version: 2, viewport: {}, autoUpdate: true },
    predefined: false,
    permittedReadUserIds: [userId],
    permittedWriteUserIds: [userId],
    defaultSharingPriority: null,
    workingCopy: { state: { graphXml, version: 2 } },
  };
  const response = await apiRequest(config, "/services/pathfinder/v1/bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

async function updateWorkingCopy(config: LeanixConfig, diagramId: string, graphXml: string): Promise<void> {
  const payload = { state: { graphXml, version: 2, viewport: {}, autoUpdate: true } };
  await apiRequest(config, `/services/pathfinder/v1/bookmarks/${diagramId}/workingCopy`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function saveDiagram(config: LeanixConfig, diagramId: string, graphXml: string): Promise<LeanixBookmark> {
  const payload = { state: { graphXml, version: 2, viewport: {}, autoUpdate: true }, lastModified: new Date().toISOString() };
  const response = await apiRequest(config, `/services/pathfinder/v1/bookmarks/${diagramId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function exportDiagram(
  config: LeanixConfig,
  name: string,
  graphXml: string,
  userId: string
): Promise<{ action: "created" | "updated"; bookmark: LeanixBookmark }> {
  // Always create a new diagram - no duplicate checking
  // Future: implement diagram matching for updates
  const bookmark = await createDiagram(config, name, graphXml, userId);
  return { action: "created", bookmark };
}

export async function updateDiagram(
  config: LeanixConfig,
  diagramId: string,
  graphXml: string
): Promise<LeanixBookmark> {
  await updateWorkingCopy(config, diagramId, graphXml);
  return saveDiagram(config, diagramId, graphXml);
}

export function getDiagramUrl(config: LeanixConfig, bookmarkId: string): string {
  return `${config.baseUrl.replace(/\/$/, "")}/pathfinder#/presentations/${bookmarkId}`;
}
