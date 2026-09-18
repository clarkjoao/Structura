/**
 * Two-phase commit helpers for filesystem writes.
 *
 * Phase 1 (Prepare): Write diagrams to .tmp files
 * Phase 2 (Commit):   Rename .tmp → .json + write manifest
 * Rollback:           Delete .tmp files on failure
 *
 * This ensures that if the manifest write fails, the workspace remains
 * consistent (no orphaned diagram files without manifest references).
 */

export interface StagedDiagramWrite {
  diagramId: string;
  /** Path segments for the .tmp file (includes .tmp segment) */
  tempSegments: string[];
  /** Path segments for the final .json file */
  finalSegments: string[];
}

export const TEMP_FILE_SUFFIX = ".tmp";

/**
 * Returns the temp filename for a diagram, e.g. "abc123.json.tmp"
 */
export function getTempFileName(diagramId: string): string {
  return `${diagramId}.json.tmp`;
}

/**
 * Checks if a filename is a staged temp file
 */
export function isTempFile(name: string): boolean {
  return name.endsWith(TEMP_FILE_SUFFIX);
}

/**
 * Converts a temp filename back to its final form, e.g. "abc123.json.tmp" → "abc123.json"
 */
export function getFinalFileName(tempName: string): string {
  return tempName.slice(0, -TEMP_FILE_SUFFIX.length);
}
