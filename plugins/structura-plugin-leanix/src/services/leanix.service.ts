/**
 * Leanix API Service
 *
 * Follows the exact format from calls-leanix.js
 */
import type { LeanixConfig } from "../types/config";

interface LeanixBookmark {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Build the state object for LeanIX API calls
 * Follows the exact format from calls-leanix.js
 */
function buildState(graphXml: string) {
  return {
    version: 2,
    graphXml,
    viewport: {
      scale: 1,
      scroll: { left: 12, top: 12 }
    },
    autoUpdate: true
  };
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

async function apiRequest<T>(config: LeanixConfig, path: string, options: RequestInit = {}): Promise<T> {
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

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // Use status text if JSON parsing fails
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Create a new diagram (bookmark) in LeanIX
 * Follows the exact format from calls-leanix.js
 */
async function createDiagram(config: LeanixConfig, name: string, graphXml: string, userId: string): Promise<LeanixBookmark> {
  // Ensure graphXml is never empty
  const safeGraphXml = graphXml || getDefaultGraphXml();

  const payload = {
    type: "VISUALIZER",
    name,
    description: "",
    groupKey: "freedraw",
    state: buildState(safeGraphXml),
    predefined: false,
    permittedReadUserIds: [userId],
    permittedWriteUserIds: [userId],
    defaultSharingPriority: null,
    workingCopy: { state: buildState(safeGraphXml) }
  };

  return apiRequest<LeanixBookmark>(config, "/services/pathfinder/v1/bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Update the editable working copy of a diagram
 * Follows the exact format from calls-leanix.js
 */
async function updateWorkingCopy(config: LeanixConfig, diagramId: string, graphXml: string): Promise<void> {
  const safeGraphXml = graphXml || getDefaultGraphXml();

  const payload = {
    state: {
      autoUpdate: true,
      viewport: {
        scale: 1,
        scroll: { left: -157.5, top: -257.5 }
      },
      graphXml: safeGraphXml,
      version: 2,
      viewLegend: []
    }
  };

  return apiRequest<void>(config, `/services/pathfinder/v1/bookmarks/${diagramId}/workingCopy`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Persist (save) a diagram
 * Follows the exact format from calls-leanix.js
 */
async function saveDiagram(config: LeanixConfig, diagramId: string, graphXml: string): Promise<LeanixBookmark> {
  const safeGraphXml = graphXml || getDefaultGraphXml();

  const payload = {
    state: {
      autoUpdate: true,
      viewport: {
        scale: 1,
        scroll: { left: -157.5, top: -257.5 }
      },
      graphXml: safeGraphXml,
      version: 2,
      viewLegend: []
    },
    lastModified: new Date().toISOString()
  };

  return apiRequest<LeanixBookmark>(config, `/services/pathfinder/v1/bookmarks/${diagramId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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

/**
 * Default minimal graph XML for empty diagrams
 * Matches the DEFAULT_GRAPH_XML from calls-leanix.js
 */
function getDefaultGraphXml(): string {
  return (
    `<mxGraphModel dx="12" dy="12" grid="1" gridSize="10" guides="1" tooltips="1" ` +
    `connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="850" pageHeight="1100" ` +
    `math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>`
  );
}
