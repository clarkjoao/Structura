import type { Diagram } from "@/features/diagram";

export interface WorkspaceStats {
  diagramCount: number;
  componentCount: number;
  flowCount: number;
}

/** Sum diagram / component / flow counts for the visible workspace scope. */
export function sumWorkspaceStats(diagrams: Diagram[]): WorkspaceStats {
  let componentCount = 0;
  let flowCount = 0;
  for (const diagram of diagrams) {
    componentCount += Object.keys(diagram.snapshot.components).length;
    flowCount += Object.keys(diagram.snapshot.flows).length;
  }
  return {
    diagramCount: diagrams.length,
    componentCount,
    flowCount,
  };
}
