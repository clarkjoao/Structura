import type { Diagnostic } from "opscr/core";
import {
  keyOf,
  manifestRef,
  removeElements,
  upsertDocument,
  type ElementRef,
  type SourceText,
} from "./engine/patches";
import { documentSource, parseDocuments } from "./engine/yaml-text";

/**
 * The chat on a bound diagram (plugin API 1.6): what the model is told, how its reply is read,
 * and how it lands in the manifests. Pure — the pane session and the validator are passed in.
 */

export interface ChatEdits {
  /** The reply without its blocks: what the model says to the user. */
  message: string;
  documents: Array<{ file?: string; source: string }>;
  deletes: ElementRef[];
}

const FENCE = /```([^\n`]*)\n([\s\S]*?)```/g;

/** Splits a reply into its prose, its `yaml file=…` documents and its `opscr-delete` lines. */
export function parseChatReply(text: string): ChatEdits {
  const documents: ChatEdits["documents"] = [];
  const deletes: ElementRef[] = [];
  const message = text.replace(FENCE, (_block, info: string, body: string) => {
    const words = info.trim().split(/\s+/);
    if (words[0] === "opscr-delete") {
      for (const line of body.split("\n")) {
        const key = line.trim();
        const slash = key.indexOf("/");
        if (slash > 0 && slash < key.length - 1) {
          deletes.push({ kind: key.slice(0, slash), name: key.slice(slash + 1) });
        }
      }
      return "";
    }
    if (words[0] !== "yaml" && words[0] !== "yml") return _block;
    const file = words.find((w) => w.startsWith("file="))?.slice("file=".length);
    for (const doc of parseDocuments(body) ?? []) {
      const source = documentSource(body, doc);
      if (source.trim()) documents.push({ ...(file ? { file } : {}), source });
    }
    return "";
  });
  return { message: message.replace(/\n{3,}/g, "\n\n").trim(), documents, deletes };
}

export interface AppliedEdits {
  files: SourceText[];
  added: string[];
  replaced: string[];
  deleted: string[];
  /** Documents that could not be applied (no kind or name, unparsable workspace). */
  skipped: number;
}

/** Applies deletions, then documents, as text patches on `files`. */
export function applyChatEdits(files: readonly SourceText[], edits: ChatEdits): AppliedEdits {
  let next = [...files];
  const result: AppliedEdits = { files: next, added: [], replaced: [], deleted: [], skipped: 0 };
  // A document that is also listed for deletion is a rewrite: keep it.
  const rewritten = new Set(
    edits.documents.map((d) => manifestRef(d.source)).flatMap((r) => (r ? [keyOf(r)] : [])),
  );
  const deletes = edits.deletes.filter((r) => !rewritten.has(keyOf(r)));
  if (deletes.length > 0) {
    const removed = removeElements(next, deletes);
    if (removed) {
      next = removed.files;
      result.deleted.push(...removed.removed.keys());
    }
  }
  for (const doc of edits.documents) {
    const upserted = upsertDocument(next, doc.source, doc.file);
    if (!upserted) {
      result.skipped += 1;
      continue;
    }
    next = upserted.files;
    (upserted.replaced ? result.replaced : result.added).push(keyOf(upserted.ref));
  }
  result.files = next;
  return result;
}

const errorKey = (d: Diagnostic) => `${d.file ?? ""}|${d.ruleId ?? ""}|${d.message}`;

/** Errors in `after` that `before` did not have (as a multiset, by file, rule and message). */
export function newErrors(
  before: readonly Diagnostic[],
  after: readonly Diagnostic[],
): Diagnostic[] {
  const seen = new Map<string, number>();
  for (const d of before) {
    if (d.severity === "error") seen.set(errorKey(d), (seen.get(errorKey(d)) ?? 0) + 1);
  }
  return after.filter((d) => {
    if (d.severity !== "error") return false;
    const left = seen.get(errorKey(d)) ?? 0;
    if (left > 0) seen.set(errorKey(d), left - 1);
    return left === 0;
  });
}

export const describeError = (d: Diagnostic) =>
  [
    `${d.file ?? "workspace"}${d.line ? `:${d.line}` : ""}: ${d.fieldPath ? `${d.fieldPath}: ` : ""}${d.message}`,
    d.suggestion ? `(${d.suggestion})` : "",
  ]
    .filter(Boolean)
    .join(" ");

/** The retry turn: the errors the change introduced, and what to send back. */
export function retryMessage(errors: readonly Diagnostic[]): string {
  return [
    "opscr validation found errors your change introduced:",
    ...errors.map((d) => `- ${describeError(d)}`),
    "",
    "Send corrected `yaml file=…` blocks (whole documents) for the affected manifests only; " +
      "the rest of your change is already applied.",
  ].join("\n");
}

const LANGUAGE = { en: "English", "pt-BR": "Brazilian Portuguese" } as const;

/** The system prompt: the role, the reply format, the skill, and the current manifests. */
export function chatSystemPrompt(
  skill: Readonly<Record<string, string>>,
  files: readonly SourceText[],
  locale: keyof typeof LANGUAGE,
): string {
  const skillText = Object.entries(skill)
    .map(([path, content]) => `<skill-file path="${path}">\n${content.trim()}\n</skill-file>`)
    .join("\n\n");
  const workspace = files
    .map((f) => `<file name="${f.name}">\n${f.text.trimEnd()}\n</file>`)
    .join("\n\n");
  return `You are the opscr editing assistant inside Structura, a diagramming app. The user's diagram is drawn from a folder of opscr manifests (YAML); you change the diagram by changing those manifests.

# How to work
- Make the change the user asks for directly. Ask one short question only when the request is genuinely ambiguous.
- Follow the opscr-architect skill below for modelling: Kinds, fields, providers, relationships, patterns and rules. Ignore its instructions about running commands, reading or writing files on disk, installing anything, or interviewing the user — you have no tools. Structura validates your change with opscr and sends you any errors it introduces.
- Keep names kebab-case and unique per Kind. The name is the element's identity: renaming means deleting the old manifest and writing the new one, and updating every edge that names it.

# How to answer
- Write every manifest you add or change as a whole YAML document in a fenced block whose info string is \`yaml file=<file name>\`, e.g. \`\`\`yaml file=commerce.opscr.yaml. Several documents may share a block, separated by \`---\`.
- A document whose kind and metadata.name already exist replaces that manifest entirely: keep its comments and every field you are not changing. New manifests go in the file they belong to; a new file must be named \`<something>.opscr.yaml\`.
- Edges live in Relationship manifests: to add, change or remove an edge, write the whole Relationship document with its new edge list.
- To delete manifests, list them one per line as \`Kind/name\` in a block with the info string \`opscr-delete\`. Edges naming them are removed for you.
- Outside the blocks, tell the user in one or two sentences what you changed, in ${LANGUAGE[locale]}. When nothing needs to change, answer without blocks.

# opscr-architect skill
${skillText}

# The user's manifests (current text, unsaved edits included)
${workspace}
`;
}
