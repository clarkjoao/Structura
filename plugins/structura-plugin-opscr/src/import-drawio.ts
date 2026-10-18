import { parseAllDocuments } from "yaml";
import type { SourceText } from "./engine/patches";

/**
 * Migrating a draw.io diagram into the bound folder: opscr's import, deterministic (no agent
 * step), run in the browser. The folder API writes top-level files only, so a drawing with
 * several architecture pages brings its first one; the others are named for the CLI.
 */

export interface DrawioImport {
  files: SourceText[];
  /** Pages with their own workspace that were not brought (several-page drawings). */
  skippedPages: string[];
  /** Why nothing can be written, when nothing can. */
  problem?: "no-diagram" | "no-architecture";
}

export async function importDrawioFile(text: string, source: string): Promise<DrawioImport> {
  // Loaded on demand: the import and its vocabulary are only needed here.
  const { importDrawio } = await import("opscr/import-drawio");
  const out = await importDrawio(text, { source });
  const analysis = out.find((f) => f.path === "analysis.json");
  const pages = analysis
    ? (JSON.parse(analysis.content) as { pages: Array<{ folder: string; page: { name: string } }> })
        .pages
    : [];
  if (pages.length === 0) {
    const unreadable =
      !analysis || (JSON.parse(analysis.content) as { problems: unknown[] }).problems.length > 0;
    return {
      files: [],
      skippedPages: [],
      problem:
        unreadable && !out.some((f) => f.path.endsWith(".opscr.yaml"))
          ? "no-diagram"
          : "no-architecture",
    };
  }
  const first = pages[0]!.folder;
  const files = out
    .filter(
      (f) =>
        (first ? f.path.startsWith(`${first}/`) : !f.path.includes("/")) ||
        f.path === "analysis.json" ||
        f.path === "IMPORT-SUMMARY.md",
    )
    .map((f) => ({
      name: first && f.path.startsWith(`${first}/`) ? f.path.slice(first.length + 1) : f.path,
      text: f.content,
    }));
  return { files, skippedPages: pages.slice(1).map((p) => p.page.name) };
}

/** Files that make a folder an opscr workspace already: an import never writes over them. */
export const isWorkspaceFile = (name: string): boolean =>
  /\.opscr\.ya?ml$/.test(name) ||
  [
    "opscr.layout.json",
    "opscr.visual.json",
    "analysis.json",
    "IMPORT-SUMMARY.md",
    "opscr.config.yaml",
  ].includes(name);

export interface ReviewItem {
  /** `Kind/name`. */
  key: string;
  evidence: string;
}

/** What the architect should look at after an import: the manifests the import assumed. */
export function reviewItems(files: readonly SourceText[]): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const file of files) {
    if (!/\.opscr\.ya?ml$/.test(file.name)) continue;
    for (const doc of parseAllDocuments(file.text)) {
      const m = doc.toJS() as {
        kind?: string;
        metadata?: { name?: string; annotations?: Record<string, string> };
      } | null;
      const annotations = m?.metadata?.annotations;
      if (!m?.kind || !m.metadata?.name || annotations?.["opscr.dev/assumed"] !== "true") continue;
      items.push({
        key: `${m.kind}/${m.metadata.name}`,
        evidence: annotations["drawio.opscr.dev/evidence"] ?? "",
      });
    }
  }
  return items;
}

/** Pages the import flagged as not looking like architecture (from `analysis.json`). */
export function notArchitecturePages(files: readonly SourceText[]): string[] {
  const analysis = files.find((f) => f.name === "analysis.json");
  if (!analysis) return [];
  try {
    const pages = (
      JSON.parse(analysis.text) as {
        pages: Array<{ page: { name: string }; recognised?: { matched: number; total: number } }>;
      }
    ).pages;
    return pages
      .filter(
        (p) =>
          p.recognised &&
          p.recognised.total >= 5 &&
          p.recognised.matched / p.recognised.total < 0.3,
      )
      .map((p) => p.page.name);
  } catch {
    return [];
  }
}
