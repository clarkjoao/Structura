import type { WalkthroughPresentation, WalkthroughStepRef } from "./walkthrough.types";
import { ensureStepIds, newStepId } from "./ensureStepIds";

/** The suffix a walkthrough's companion file takes, beside the diagrams of its folder. */
export const WALKTHROUGH_FILE_SUFFIX = ".walkthrough.json";

/** Names the file for what it is, whatever it has been renamed to. */
export const WALKTHROUGH_FILE_KIND = "structura-walkthrough";

export const WALKTHROUGH_SCHEMA_VERSION = 1;

/**
 * A walkthrough as it sits on disk.
 *
 * Self-contained by design: everything needed to reconstruct the walkthrough is
 * here, so a folder can be copied, committed or handed on and arrive whole. The
 * only reference out of it is `steps[].diagramId`, and nothing on the diagram
 * side ever points back.
 */
export interface WalkthroughFile {
  kind: typeof WALKTHROUGH_FILE_KIND;
  schemaVersion: number;
  walkthrough: WalkthroughPresentation;
}

export function toWalkthroughFile(presentation: WalkthroughPresentation): WalkthroughFile {
  return {
    kind: WALKTHROUGH_FILE_KIND,
    schemaVersion: WALKTHROUGH_SCHEMA_VERSION,
    walkthrough: presentation,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSteps(value: unknown): WalkthroughStepRef[] | null {
  if (!Array.isArray(value)) return null;
  const steps: WalkthroughStepRef[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    if (typeof entry.diagramId !== "string" || typeof entry.flowId !== "string") return null;
    steps.push({
      // A file written before scenes had ids gets one here rather than at the
      // call site, so every path into the store produces identified scenes.
      id: typeof entry.id === "string" && entry.id ? entry.id : newStepId(),
      diagramId: entry.diagramId,
      flowId: entry.flowId,
      label: typeof entry.label === "string" ? entry.label : undefined,
      note: typeof entry.note === "string" ? entry.note : undefined,
    });
  }
  return steps;
}

/**
 * Reads a walkthrough back off disk, or returns null.
 *
 * Never throws: a corrupt or hand-edited file is something to skip with a
 * warning, not something to take the library down with. Returning null means
 * "this is not a walkthrough I can read" — the caller treats the file as
 * present but unusable, never as absent, because absence is what the
 * reconciliation reads as a deletion.
 */
export function fromWalkthroughFile(raw: unknown): WalkthroughPresentation | null {
  if (!isRecord(raw)) return null;
  if (raw.kind !== WALKTHROUGH_FILE_KIND) return null;

  const version = raw.schemaVersion;
  if (typeof version !== "number") return null;
  // A file from a later version of the app may carry fields this one would
  // silently drop on the next write. Better to leave it alone.
  if (version > WALKTHROUGH_SCHEMA_VERSION) return null;

  const walkthrough = raw.walkthrough;
  if (!isRecord(walkthrough)) return null;
  if (typeof walkthrough.id !== "string" || walkthrough.id.length === 0) return null;
  if (typeof walkthrough.title !== "string") return null;

  const steps = readSteps(walkthrough.steps);
  if (!steps) return null;

  return ensureStepIds({
    id: walkthrough.id,
    title: walkthrough.title,
    description: typeof walkthrough.description === "string" ? walkthrough.description : undefined,
    authorNotes: typeof walkthrough.authorNotes === "string" ? walkthrough.authorNotes : undefined,
    folderId: typeof walkthrough.folderId === "string" ? walkthrough.folderId : null,
    steps,
    createdAt: typeof walkthrough.createdAt === "number" ? walkthrough.createdAt : 0,
    updatedAt: typeof walkthrough.updatedAt === "number" ? walkthrough.updatedAt : 0,
  });
}
