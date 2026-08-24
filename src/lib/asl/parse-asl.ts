import type { AslIssue } from "./asl.types";

/**
 * Multi-document YAML parsing for ASL files.
 *
 * The `yaml` package is pulled in with a dynamic import so it stays out of the
 * initial bundle — the same treatment `elkjs` and Monaco get. An ASL file is
 * only ever read when the user imports one.
 */

export interface AslRawDocument {
  /** Position in the source file, used by every downstream issue. */
  index: number;
  value: unknown;
}

export type AslParseResult =
  | { ok: true; documents: AslRawDocument[] }
  | { ok: false; issues: AslIssue[] };

type ParseAllDocuments = typeof import("yaml").parseAllDocuments;

let parseAllDocuments: ParseAllDocuments | null = null;

async function getParser(): Promise<ParseAllDocuments> {
  if (!parseAllDocuments) {
    const module = await import("yaml");
    parseAllDocuments = module.parseAllDocuments;
  }
  return parseAllDocuments;
}

/**
 * Splits a `---`-separated ASL file into documents.
 *
 * Empty documents (a trailing `---`, a comment-only block) are dropped without
 * complaint — they carry no manifest and are not a mistake. A document that
 * fails to parse is reported with its position; the caller decides what to do,
 * but nothing partial reaches the store.
 */
export async function parseAslDocuments(source: string): Promise<AslParseResult> {
  const parse = await getParser();
  const issues: AslIssue[] = [];
  const documents: AslRawDocument[] = [];

  let parsed;
  try {
    parsed = parse(source);
  } catch (error) {
    return {
      ok: false,
      issues: [
        { code: "invalidYaml", params: { index: 0, message: describeError(error) } },
      ],
    };
  }

  parsed.forEach((document, index) => {
    if (document.errors.length > 0) {
      issues.push({
        code: "invalidYaml",
        params: { index, message: document.errors[0].message },
      });
      return;
    }
    const value: unknown = document.toJS();
    if (value === null || value === undefined) return;
    documents.push({ index, value });
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  if (documents.length === 0) {
    return { ok: false, issues: [{ code: "noManifests" }] };
  }

  return { ok: true, documents };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
