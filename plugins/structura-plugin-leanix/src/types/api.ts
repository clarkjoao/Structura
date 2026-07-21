/**
 * Leanix API response types
 */

/** Search response from presentations/search */
export interface LeanixDiagramSearchResponse {
  data?: LeanixBookmark[];
}

/** Bookmark/document in Leanix */
export interface LeanixBookmark {
  id: string;
  name: string;
  description?: string;
  type?: string;
  groupKey?: string;
  state?: LeanixDiagramState;
  permittedReadUserIds?: string[];
  permittedWriteUserIds?: string[];
  defaultSharingPriority?: string | null;
  workingCopy?: {
    state?: LeanixDiagramState;
  };
  lastModified?: string;
}

/** State containing the mxGraph XML */
export interface LeanixDiagramState {
  graphXml?: string;
  version?: number;
  viewport?: Record<string, unknown>;
  autoUpdate?: boolean;
}

/** Request body for creating a bookmark */
export interface CreateBookmarkRequest {
  type: string;
  name: string;
  description: string;
  groupKey: string;
  state: LeanixDiagramState;
  permittedReadUserIds: string[];
  permittedWriteUserIds: string[];
  defaultSharingPriority: null;
  workingCopy: {
    state: LeanixDiagramState;
  };
}

/** Request body for updating working copy */
export interface UpdateWorkingCopyRequest {
  state: LeanixDiagramState;
}

/** Request body for saving a bookmark */
export interface SaveBookmarkRequest {
  state: LeanixDiagramState;
  lastModified: string;
}
