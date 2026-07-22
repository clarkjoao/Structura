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

/**
 * Upload progress as a ratio 0→1. null means the browser does not expose progress info.
 */
export type ProgressCallback = (ratio: number | null) => void;

/**
 * Like exportDiagram but fires onProgress while the request body is being sent.
 * Uses XMLHttpRequest because fetch does not expose upload progress.
 */
export function exportDiagramWithProgress(
  config: LeanixConfig,
  name: string,
  graphXml: string,
  userId: string,
  onProgress: ProgressCallback,
): Promise<{ action: "created" | "updated"; bookmark: LeanixBookmark }> {
  return new Promise((resolve, reject) => {
    const targetUrl = config.useProxy
      ? `${config.proxyUrl.replace(/\/$/, "")}?url=${encodeURIComponent(`${config.baseUrl.replace(/\/$/, "")}/services/pathfinder/v1/bookmarks`)}`
      : `${config.baseUrl.replace(/\/$/, "")}/services/pathfinder/v1/bookmarks`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", targetUrl, true);

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
      workingCopy: { state: buildState(safeGraphXml) },
    };
    const body = JSON.stringify(payload);

    xhr.setRequestHeader("Authorization", ensureBearerPrefix(config.authToken));
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.addEventListener("progress", (e) => {
      onProgress(e.lengthComputable ? e.loaded / e.total : null);
    });
    // Also fire at 100% to avoid a final frame stuck at 99%
    xhr.upload.addEventListener("load", () => onProgress(1));

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const bookmark = JSON.parse(xhr.responseText) as LeanixBookmark;
          resolve({ action: "created", bookmark });
        } catch {
          reject(new Error("Invalid JSON response from LeanIX"));
        }
      } else {
        let reason = `HTTP ${xhr.status}`;
        try {
          const data = JSON.parse(xhr.responseText);
          reason = data.message || data.error || reason;
        } catch { /* use status */ }
        reject(new Error(reason));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error reaching LeanIX")));
    xhr.addEventListener("abort", () => reject(new Error("Request aborted")));

    xhr.send(body);
  });
}

/**
 * Export a diagram to LeanIX. Convenience wrapper around exportDiagramWithProgress
 * that ignores progress (use exportDiagramWithProgress directly when progress is needed).
 */
export async function exportDiagram(
  config: LeanixConfig,
  name: string,
  graphXml: string,
  userId: string,
): Promise<{ action: "created" | "updated"; bookmark: LeanixBookmark }> {
  return exportDiagramWithProgress(config, name, graphXml, userId, () => {/* no-op */});
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
 * Test the connection to LeanIX.
 *
 * Uses a lightweight list call (no diagram is created). Returns
 * { ok: true } on success, or { ok: false, reason } with a short
 * human-readable failure reason suitable for surfacing in the UI.
 */
export async function testConnection(
  config: LeanixConfig,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await apiRequest<unknown>(config, "/services/pathfinder/v1/bookmarks?pageSize=1&bookmarkType=VISUALIZER", {
      method: "GET",
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: classifyError(error) };
  }
}

/**
 * Map a thrown error to a short, human-readable reason string.
 * Keeps the UX feedback specific (token vs network vs server) without
 * leaking raw stack traces to the user.
 */
export function classifyError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message || "";
    if (/401|403|unauthor|forbidden|token/i.test(msg)) {
      return "Token expired or invalid";
    }
    if (/404|not\s*found/i.test(msg)) {
      return "Endpoint not found";
    }
    if (/500|502|503|504|server/i.test(msg)) {
      return "Leanix server error";
    }
    if (/network|fetch|failed to fetch|cors/i.test(msg)) {
      return "Could not reach Leanix (network or proxy)";
    }
    if (msg) return msg;
  }
  return "Unknown error";
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
