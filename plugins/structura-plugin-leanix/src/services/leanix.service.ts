import type { LeanixConfig } from "../types/config";
import type {
  LeanixBookmark,
  LeanixDiagramSearchResponse,
  CreateBookmarkRequest,
  UpdateWorkingCopyRequest,
  SaveBookmarkRequest,
} from "../types/api";

/** Base URL for Leanix API proxy */
const PROXY_BASE = "/leanix";

/**
 * Leanix API service for diagram export operations
 */
export class LeanixService {
  private config: LeanixConfig;

  constructor(config: LeanixConfig) {
    this.config = config;
  }

  /**
   * Build headers for API requests
   */
  private buildHeaders(): HeadersInit {
    return {
      Authorization: this.config.authToken,
      accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  /**
   * Make a request to the Leanix API via proxy
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> {
    const url = `${PROXY_BASE}${endpoint}`;
    const maxRetries = 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.buildHeaders(),
            ...options.headers,
          },
        });

        // Handle specific status codes
        if (response.status === 204) {
          return null;
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "Unknown error");

          if (response.status === 401 || response.status === 403) {
            throw new LeanixAuthError("Invalid or expired token", response.status);
          }

          if (response.status >= 500) {
            throw new LeanixServerError(`Leanix internal error: ${response.status}`, response.status);
          }

          throw new LeanixApiError(`API error: ${response.status}`, response.status, errorBody);
        }

        return await response.json();
      } catch (error) {
        if (error instanceof LeanixError) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw new LeanixNetworkError(lastError?.message || "Network error");
  }

  /**
   * Search for existing diagrams by name
   */
  async searchDiagrams(name: string): Promise<LeanixBookmark[]> {
    // Truncate name to 255 chars as per API limits
    const searchTerm = encodeURIComponent(name.slice(0, 255));

    const response = await this.request<LeanixDiagramSearchResponse>(
      `/services/navigation/v1/presentations/search?searchTerm=${searchTerm}`
    );

    return response?.data || [];
  }

  /**
   * Create a new diagram in Leanix
   */
  async createDiagram(
    name: string,
    graphXml: string,
    userId: string
  ): Promise<LeanixBookmark> {
    const body: CreateBookmarkRequest = {
      type: "VISUALIZER",
      name,
      description: "",
      groupKey: "freedraw",
      state: {
        graphXml,
        version: 2,
        viewport: {},
        autoUpdate: true,
      },
      permittedReadUserIds: [userId],
      permittedWriteUserIds: [userId],
      defaultSharingPriority: null,
      workingCopy: {
        state: {
          graphXml,
          version: 2,
        },
      },
    };

    return await this.request<LeanixBookmark>(
      "/services/pathfinder/v1/bookmarks",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Update the working copy of an existing diagram
   */
  async updateWorkingCopy(id: string, graphXml: string): Promise<void> {
    const body: UpdateWorkingCopyRequest = {
      state: {
        graphXml,
        version: 2,
        viewport: {},
        autoUpdate: true,
      },
    };

    await this.request<void>(
      `/services/pathfinder/v1/bookmarks/${id}/workingCopy`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Save/publish the diagram
   */
  async saveDiagram(id: string, graphXml: string): Promise<LeanixBookmark> {
    const body: SaveBookmarkRequest = {
      state: {
        graphXml,
        version: 2,
        viewport: {},
        autoUpdate: true,
      },
      lastModified: new Date().toISOString(),
    };

    return await this.request<LeanixBookmark>(
      `/services/pathfinder/v1/bookmarks/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Export diagram: search first, then update or create
   */
  async exportDiagram(
    name: string,
    graphXml: string,
    userId: string
  ): Promise<{ action: "created" | "updated"; bookmark: LeanixBookmark }> {
    // Search for existing diagram
    const existing = await this.searchDiagrams(name);

    if (existing.length > 0) {
      // Update existing diagram
      const bookmark = existing[0];
      await this.updateWorkingCopy(bookmark.id, graphXml);
      const updated = await this.saveDiagram(bookmark.id, graphXml);
      return { action: "updated", bookmark: updated };
    } else {
      // Create new diagram
      const bookmark = await this.createDiagram(name, graphXml, userId);
      return { action: "created", bookmark };
    }
  }

  /**
   * Get the direct URL to a Leanix diagram
   */
  getDiagramUrl(bookmarkId: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    return `${baseUrl}/pathfinder#/presentations/${bookmarkId}`;
  }
}

/**
 * Base error class for Leanix errors
 */
export class LeanixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeanixError";
  }
}

/**
 * Authentication error (401/403)
 */
export class LeanixAuthError extends LeanixError {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "LeanixAuthError";
  }
}

/**
 * Server error (500+)
 */
export class LeanixServerError extends LeanixError {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "LeanixServerError";
  }
}

/**
 * API error (other status codes)
 */
export class LeanixApiError extends LeanixError {
  constructor(message: string, public statusCode: number, public body?: string) {
    super(message);
    this.name = "LeanixApiError";
  }
}

/**
 * Network error
 */
export class LeanixNetworkError extends LeanixError {
  constructor(message: string) {
    super(message);
    this.name = "LeanixNetworkError";
  }
}
