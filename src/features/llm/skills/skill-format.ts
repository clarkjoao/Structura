import { z } from "zod";
import type { Skill, SkillFields } from "./skill.types";

/**
 * The skill file format, shared by workspace files, local skills, import and
 * export: a front matter block with `name`, `description` and an optional
 * `tools` list, then the instructions as the body.
 *
 * ```markdown
 * ---
 * name: AWS review
 * description: Review diagrams with AWS services
 * tools: [get_diagram_summary, get_node_details]
 * ---
 * Assess each service against the six Well-Architected pillars...
 * ```
 *
 * The parser is deliberately strict and small: it reads exactly the subset of
 * YAML the format needs (strings, and flow or block lists of strings) instead
 * of pulling in a YAML dependency.
 */

export const SKILL_LIMITS = {
  name: 60,
  description: 200,
  instructions: 8_000,
  /** Bytes, UTF-8. */
  file: 16 * 1024,
} as const;

export type SkillParseErrorCode =
  | "fileTooLarge"
  | "missingFrontmatter"
  | "unclosedFrontmatter"
  | "invalidLine"
  | "duplicateKey"
  | "invalidValue"
  | "invalidList"
  | "missingField"
  | "tooLong";

/** Why a file is not a skill, and where. `line` is 1-based. */
export interface SkillParseError {
  line: number;
  code: SkillParseErrorCode;
  /** The key or field involved, when there is one. */
  field?: string;
  /** The limit that was exceeded, for `tooLong` and `fileTooLarge`. */
  max?: number;
}

export type SkillParseWarningCode = "unknownKey";

export interface SkillParseWarning {
  line: number;
  code: SkillParseWarningCode;
  field: string;
}

export type SkillParseResult =
  | { ok: true; fields: SkillFields; warnings: SkillParseWarning[] }
  | { ok: false; error: SkillParseError };

export function isSkillParseFailure(
  result: SkillParseResult,
): result is Extract<SkillParseResult, { ok: false }> {
  return !result.ok;
}

const KNOWN_KEYS = ["name", "description", "tools"] as const;
type KnownKey = (typeof KNOWN_KEYS)[number];

function isKnownKey(key: string): key is KnownKey {
  return KNOWN_KEYS.some((known) => known === key);
}

const SkillFieldsSchema = z.object({
  name: z.string().min(1).max(SKILL_LIMITS.name),
  description: z.string().min(1).max(SKILL_LIMITS.description),
  instructions: z.string().max(SKILL_LIMITS.instructions),
  tools: z.array(z.string().min(1)).optional(),
});

type SkillFieldName = keyof z.infer<typeof SkillFieldsSchema>;

const FIELD_LIMITS: Record<SkillFieldName, number | undefined> = {
  name: SKILL_LIMITS.name,
  description: SKILL_LIMITS.description,
  instructions: SKILL_LIMITS.instructions,
  tools: undefined,
};

function isSkillFieldName(value: unknown): value is SkillFieldName {
  return typeof value === "string" && value in FIELD_LIMITS;
}

class FormatError extends Error {
  constructor(readonly detail: SkillParseError) {
    super(detail.code);
  }
}

function fail(detail: SkillParseError): never {
  throw new FormatError(detail);
}

const KEY_LINE = /^([A-Za-z_][\w-]*)[ \t]*:(?:[ \t]+(.*))?$/;
const BLOCK_ITEM = /^[ \t]*-(?:[ \t]+(.*))?$/;

/** What may follow a value on its line: nothing, or a comment. */
function assertTrailing(rest: string, line: number): void {
  const trimmed = rest.trim();
  if (trimmed.length > 0 && !trimmed.startsWith("#")) fail({ line, code: "invalidValue" });
}

/**
 * A quoted string starting at `start` (`"` or `'`). Returns the value and the
 * index after the closing quote. Double quotes use JSON escapes; single quotes
 * escape a quote by doubling it.
 */
function readQuoted(text: string, start: number, line: number): { value: string; end: number } {
  const quote = text[start];
  if (quote === "'") {
    let value = "";
    let index = start + 1;
    while (index < text.length) {
      const char = text[index];
      if (char === "'") {
        if (text[index + 1] === "'") {
          value += "'";
          index += 2;
          continue;
        }
        return { value, end: index + 1 };
      }
      value += char;
      index += 1;
    }
    return fail({ line, code: "invalidValue" });
  }
  let index = start + 1;
  while (index < text.length) {
    const char = text[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === '"') {
      try {
        const parsed: unknown = JSON.parse(text.slice(start, index + 1));
        if (typeof parsed === "string") return { value: parsed, end: index + 1 };
      } catch {
        // Falls through to the error below.
      }
      return fail({ line, code: "invalidValue" });
    }
    index += 1;
  }
  return fail({ line, code: "invalidValue" });
}

/** A plain scalar ends at a comment (` #`). */
function stripComment(text: string): string {
  const match = text.match(/(^|[ \t])#/);
  return (match?.index !== undefined ? text.slice(0, match.index) : text).trim();
}

function readScalar(text: string, line: number): string {
  const trimmed = text.trim();
  const first = trimmed[0];
  if (first === '"' || first === "'") {
    const { value, end } = readQuoted(trimmed, 0, line);
    assertTrailing(trimmed.slice(end), line);
    return value;
  }
  if (first === "[" || first === "{") fail({ line, code: "invalidValue" });
  return stripComment(trimmed);
}

/** `[a, "b", 'c']`. A trailing comma is allowed; an empty item is not. */
function readFlowList(text: string, line: number): string[] {
  const trimmed = text.trim();
  const items: string[] = [];
  let index = 1;
  let expectItem = true;
  while (index < trimmed.length) {
    const char = trimmed[index] ?? "";
    if (/[ \t]/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "]") {
      assertTrailing(trimmed.slice(index + 1), line);
      return items;
    }
    if (char === ",") {
      if (expectItem) fail({ line, code: "invalidList" });
      expectItem = true;
      index += 1;
      continue;
    }
    if (!expectItem) fail({ line, code: "invalidList" });
    if (char === '"' || char === "'") {
      const { value, end } = readQuoted(trimmed, index, line);
      items.push(value);
      index = end;
    } else {
      const match = trimmed.slice(index).match(/^[^,\]]+/);
      const value = (match?.[0] ?? "").trim();
      if (value.length === 0 || /["'[{#]/.test(value)) fail({ line, code: "invalidList" });
      items.push(value);
      index += match?.[0].length ?? 0;
    }
    expectItem = false;
  }
  return fail({ line, code: "invalidList" });
}

interface RawEntry {
  value: string | string[];
  line: number;
}

/** The front matter's key/value pairs, in a strict YAML subset. */
function readFrontMatter(lines: readonly string[], firstLine: number): Map<string, RawEntry> {
  const entries = new Map<string, RawEntry>();
  /** A key written as `key:` with nothing after it, which may own a block list. */
  let blockKey: string | null = null;

  lines.forEach((raw, offset) => {
    const line = firstLine + offset;
    if (raw.trim().length === 0 || raw.trimStart().startsWith("#")) return;

    const item = raw.match(BLOCK_ITEM);
    if (item) {
      const entry = blockKey ? entries.get(blockKey) : undefined;
      if (!entry) return fail({ line, code: "invalidLine" });
      const value = readScalar(item[1] ?? "", line);
      if (value.length === 0) fail({ line, code: "invalidList" });
      entry.value = Array.isArray(entry.value) ? [...entry.value, value] : [value];
      return;
    }

    const match = raw.match(KEY_LINE);
    if (!match) return fail({ line, code: "invalidLine" });
    const key = match[1] ?? "";
    if (entries.has(key)) fail({ line, code: "duplicateKey", field: key });
    const rest = match[2] ?? "";
    blockKey = null;
    if (rest.trim().length === 0 || rest.trim().startsWith("#")) {
      entries.set(key, { value: "", line });
      blockKey = key;
      return;
    }
    const value = rest.trim().startsWith("[") ? readFlowList(rest, line) : readScalar(rest, line);
    entries.set(key, { value, line });
  });

  return entries;
}

function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function parse(text: string): { fields: SkillFields; warnings: SkillParseWarning[] } {
  if (new TextEncoder().encode(text).length > SKILL_LIMITS.file) {
    fail({ line: 1, code: "fileTooLarge", max: SKILL_LIMITS.file });
  }
  const lines = normalizeText(text).split("\n");
  if (lines[0]?.trimEnd() !== "---") fail({ line: 1, code: "missingFrontmatter" });
  const close = lines.findIndex((line, index) => index > 0 && line.trimEnd() === "---");
  if (close === -1) fail({ line: 1, code: "unclosedFrontmatter" });

  const entries = readFrontMatter(lines.slice(1, close), 2);
  const warnings: SkillParseWarning[] = [];
  const known: Partial<Record<KnownKey, RawEntry>> = {};
  for (const [key, entry] of entries) {
    if (isKnownKey(key)) {
      known[key] = entry;
    } else {
      warnings.push({ line: entry.line, code: "unknownKey", field: key });
    }
  }

  const stringField = (key: "name" | "description"): string => {
    const entry = known[key];
    if (!entry) return "";
    if (Array.isArray(entry.value)) fail({ line: entry.line, code: "invalidValue", field: key });
    return entry.value.trim();
  };

  let tools: string[] | undefined;
  const toolsEntry = known.tools;
  if (toolsEntry) {
    if (!Array.isArray(toolsEntry.value)) {
      // `tools:` with no items reads as an empty list: every tool.
      if (toolsEntry.value.length > 0) {
        fail({ line: toolsEntry.line, code: "invalidValue", field: "tools" });
      }
    } else {
      tools = [...new Set(toolsEntry.value.map((tool) => tool.trim()))];
    }
  }

  const candidate = {
    name: stringField("name"),
    description: stringField("description"),
    instructions: lines
      .slice(close + 1)
      .join("\n")
      .trim(),
    ...(tools && tools.length > 0 ? { tools } : {}),
  };

  const result = SkillFieldsSchema.safeParse(candidate);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path[0];
    if (!isSkillFieldName(field)) return fail({ line: 1, code: "invalidValue" });
    const line = isKnownKey(field) ? (known[field]?.line ?? 1) : close + 2;
    const value = candidate[field];
    const max = FIELD_LIMITS[field];
    if (max !== undefined && typeof value === "string" && value.length > max) {
      return fail({ line, code: "tooLong", field, max });
    }
    if (value === undefined || (typeof value === "string" && value.length === 0)) {
      return fail({ line, code: "missingField", field });
    }
    return fail({ line, code: "invalidValue", field });
  }
  const fields: SkillFields = {
    name: result.data.name,
    description: result.data.description,
    instructions: result.data.instructions,
    ...(result.data.tools ? { tools: result.data.tools } : {}),
  };
  return { fields, warnings };
}

/** Reads a skill file. Never throws: a broken file is a typed error with its line. */
export function parseSkillMarkdown(text: string): SkillParseResult {
  try {
    const { fields, warnings } = parse(text);
    for (const warning of warnings) {
      console.warn(`[skills] unknown key "${warning.field}" on line ${warning.line} ignored`);
    }
    return { ok: true, fields, warnings };
  } catch (error) {
    if (error instanceof FormatError) return { ok: false, error: error.detail };
    throw error;
  }
}

/** Characters that would make a plain scalar read as something else. */
const SPECIAL_START = /^[\s"'#[\]{}&*!|>%@`,?:-]/;
const PLAIN_ITEM = /^[\w.:/-]+$/;

function formatScalar(value: string): string {
  const plain =
    value.length > 0 &&
    !SPECIAL_START.test(value) &&
    !/[\n\t]|: | #/.test(value) &&
    !value.endsWith(":") &&
    value === value.trim();
  return plain ? value : JSON.stringify(value);
}

function formatItem(value: string): string {
  return PLAIN_ITEM.test(value) && !value.startsWith("-") ? value : JSON.stringify(value);
}

/** Writes a skill file that `parseSkillMarkdown` reads back to the same fields. */
export function serializeSkillMarkdown(
  skill: Pick<Skill, "name" | "description" | "instructions" | "tools">,
): string {
  const lines = [
    "---",
    `name: ${formatScalar(skill.name.trim())}`,
    `description: ${formatScalar(skill.description.trim())}`,
  ];
  if (skill.tools && skill.tools.length > 0) {
    lines.push(`tools: [${skill.tools.map(formatItem).join(", ")}]`);
  }
  lines.push("---");
  const body = skill.instructions.trim();
  return `${lines.join("\n")}\n${body.length > 0 ? `${body}\n` : ""}`;
}

/** A file name for a skill: its name, lower-cased, with anything unsafe as `-`. */
export function skillFileStem(name: string): string {
  const stem = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return stem.length > 0 ? stem : "skill";
}
