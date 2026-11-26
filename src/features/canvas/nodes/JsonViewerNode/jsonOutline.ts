/** The shape of a JSON value, as the outline names it. */
export type JsonValueKind = "string" | "number" | "boolean" | "null" | "array" | "object";

export interface JsonOutlineEntry {
  /** The property name, or `[index]` for an array item. */
  key: string;
  kind: JsonValueKind;
  /** Items in an array, keys in an object. */
  size?: number;
}

export type JsonOutline =
  | { valid: true; root: JsonValueKind; entries: JsonOutlineEntry[]; total: number }
  | { valid: false };

function kindOf(value: unknown): JsonValueKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "object";
  }
}

function sizeOf(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object") return Object.keys(value).length;
  return undefined;
}

function entry(key: string, value: unknown): JsonOutlineEntry {
  const size = sizeOf(value);
  return { key, kind: kindOf(value), ...(size === undefined ? {} : { size }) };
}

/**
 * The top level of a JSON document: each key (or array item) and the kind of value it holds, so a
 * collapsed viewer reads as the payload's shape rather than its first characters.
 */
export function jsonOutline(raw: string, limit: number): JsonOutline {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { valid: false };
  }
  const root = kindOf(value);
  if (Array.isArray(value)) {
    return {
      valid: true,
      root,
      entries: value.slice(0, limit).map((item, index) => entry(`[${index}]`, item)),
      total: value.length,
    };
  }
  if (value !== null && typeof value === "object") {
    const pairs = Object.entries(value);
    return {
      valid: true,
      root,
      entries: pairs.slice(0, limit).map(([key, item]) => entry(key, item)),
      total: pairs.length,
    };
  }
  return { valid: true, root, entries: [], total: 0 };
}

export interface JsonSyntaxError {
  message: string;
  /** 1-based, when the parser said where. */
  line?: number;
  column?: number;
}

/** Where a JSON document stops parsing, from the engine's own message; null when it parses. */
export function jsonSyntaxError(raw: string): JsonSyntaxError | null {
  try {
    JSON.parse(raw);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lineColumn = /line (\d+) column (\d+)/.exec(message);
    if (lineColumn) {
      return { message, line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
    }
    const position = /position (\d+)/.exec(message);
    if (position) {
      const before = raw.slice(0, Number(position[1])).split("\n");
      return { message, line: before.length, column: (before[before.length - 1]?.length ?? 0) + 1 };
    }
    return { message };
  }
}
