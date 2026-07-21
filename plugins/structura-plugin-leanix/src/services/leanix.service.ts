/**
 * Leanix API Service
 */
import type { LeanixConfig } from "../types/config";

const PROXY_BASE = "/leanix";

interface LeanixBookmark {
  id: string;
  name?: string;
  [key: string]: unknown;
}

interface LeanixSearchResponse {
  data?: LeanixBookmark[];
}

async function searchDiagrams(config: LeanixConfig, name: string): Promise<LeanixBookmark[]> {
  const searchTerm = encodeURIComponent(name.slice(0, 255));
  const response = await fetch(
    `${PROXY_BASE}/services/navigation/v1/presentations/search?searchTerm=${searchTerm}`,
    { headers: { Authorization: config.authToken, accept: "application/json" } }
  );
  const data: LeanixSearchResponse = await response.json();
  return data?.data || [];
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
  const response = await fetch(`${PROXY_BASE}/services/pathfinder/v1/bookmarks`, {
    method: "POST",
    headers: { Authorization: config.authToken, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

async function updateWorkingCopy(config: LeanixConfig, diagramId: string, graphXml: string): Promise<void> {
  const payload = { state: { graphXml, version: 2, viewport: {}, autoUpdate: true } };
  await fetch(`${PROXY_BASE}/services/pathfinder/v1/bookmarks/${diagramId}/workingCopy`, {
    method: "PUT",
    headers: { Authorization: config.authToken, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function saveDiagram(config: LeanixConfig, diagramId: string, graphXml: string): Promise<LeanixBookmark> {
  const payload = { state: { graphXml, version: 2, viewport: {}, autoUpdate: true }, lastModified: new Date().toISOString() };
  const response = await fetch(`${PROXY_BASE}/services/pathfinder/v1/bookmarks/${diagramId}`, {
    method: "PUT",
    headers: { Authorization: config.authToken, "Content-Type": "application/json" },
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
  const existing = await searchDiagrams(config, name);
  if (existing.length > 0) {
    const bookmark = existing[0];
    await updateWorkingCopy(config, bookmark.id, graphXml);
    const updated = await saveDiagram(config, bookmark.id, graphXml);
    return { action: "updated", bookmark: updated };
  } else {
    const bookmark = await createDiagram(config, name, graphXml, userId);
    return { action: "created", bookmark };
  }
}

export function getDiagramUrl(config: LeanixConfig, bookmarkId: string): string {
  return `${config.baseUrl.replace(/\/$/, "")}/pathfinder#/presentations/${bookmarkId}`;
}
