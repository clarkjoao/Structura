/**
 * A diagram's kind: which editor guides its construction.
 *
 * A kind is metadata over an ordinary diagram, never a file format — the
 * content of a kind diagram is made only of elements, connections and flows a
 * freehand diagram can hold, so the viewer, the exporters and persistence never
 * need the kind to be registered (see `docs/concepts/diagram-kinds.md`).
 *
 * Three optional fields, all absent on a freehand diagram so it hashes and
 * exports as before:
 * - `kind`: the kind id — a built-in (`guided`) or a contributed one
 *   (`<pluginId>:<kind-id>`). Kept even when nothing registers it, so a
 *   missing plugin never destroys data.
 * - `kindMode`: `"freehand"` while the author edits the diagram freehand; absent
 *   means the kind's own editor.
 * - `kindData`: a JSON object the kind owns, opaque to everything else.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type DiagramKindMode = "freehand";

/** The kind fields as they sit on a `Diagram`. */
export interface DiagramKindFields {
  kind?: string;
  kindMode?: DiagramKindMode;
  kindData?: JsonObject;
}

/** The pseudo-kind naming "no kind" where a list of kinds is expected (panel `appliesTo`). */
export const FREEHAND_KIND = "freehand";

/** Serialized size cap of `kindData`, in UTF-16 code units of its JSON text. */
export const KIND_DATA_MAX_CHARS = 64 * 1024;

const SEGMENT = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";
const BUILT_IN_KIND_ID = new RegExp(`^${SEGMENT}$`);
/** Plugin ids are free-form but bounded: anything up to the colon without whitespace. */
const CONTRIBUTED_KIND_ID = new RegExp(`^[A-Za-z0-9._@/-]{1,100}:${SEGMENT}$`);

/** A built-in kind id: lowercase kebab-case, and not the `freehand` pseudo-kind. */
export function isBuiltInKindId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    value !== FREEHAND_KIND &&
    BUILT_IN_KIND_ID.test(value)
  );
}

/** A contributed kind id: `<pluginId>:<kind-id>`. */
export function isContributedKindId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 165 && CONTRIBUTED_KIND_ID.test(value);
}

/** A well-formed kind id, registered or not. */
export function isKindId(value: unknown): value is string {
  return isBuiltInKindId(value) || isContributedKindId(value);
}

/** The diagram has a kind (registered or not). */
export function hasKind(
  diagram: DiagramKindFields,
): diagram is DiagramKindFields & { kind: string } {
  return isKindId(diagram.kind);
}

/** The diagram has a kind and is being edited freehand. */
export function isKindFreehandMode(diagram: DiagramKindFields): boolean {
  return hasKind(diagram) && diagram.kindMode === "freehand";
}

function isJsonValue(value: unknown, depth: number): value is JsonValue {
  if (depth > 32) return false;
  if (value === null) return true;
  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object":
      if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
      return isJsonObjectAt(value, depth + 1);
    default:
      return false;
  }
}

function isJsonObjectAt(value: unknown, depth: number): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value).every((item) => isJsonValue(item, depth));
}

/** A plain JSON object no larger than {@link KIND_DATA_MAX_CHARS} serialized. */
function isKindData(value: unknown): value is JsonObject {
  if (!isJsonObjectAt(value, 0)) return false;
  try {
    return JSON.stringify(value).length <= KIND_DATA_MAX_CHARS;
  } catch {
    return false;
  }
}

/**
 * The kind fields of an untrusted source (a file, a folder, a link, a peer),
 * keeping what is well-formed and dropping the rest. A well-formed kind is kept
 * whether or not anything registers it. `kindMode` and `kindData` mean nothing
 * without a kind and are dropped with it.
 */
export function sanitizeKindFields(source: {
  kind?: unknown;
  kindMode?: unknown;
  kindData?: unknown;
}): DiagramKindFields {
  if (!isKindId(source.kind)) return {};
  return {
    kind: source.kind,
    ...(source.kindMode === "freehand" && { kindMode: "freehand" as const }),
    ...(isKindData(source.kindData) && { kindData: source.kindData }),
  };
}

/**
 * `target` with its kind fields replaced by the sanitized ones of `source`.
 * Absent fields are removed rather than written as `undefined`, so a freehand
 * diagram keeps exactly the keys it had.
 */
export function withSanitizedKindFields<T extends DiagramKindFields>(
  target: T,
  source: { kind?: unknown; kindMode?: unknown; kindData?: unknown },
): T {
  const { kind: _kind, kindMode: _kindMode, kindData: _kindData, ...rest } = target;
  return { ...rest, ...sanitizeKindFields(source) } as T;
}
