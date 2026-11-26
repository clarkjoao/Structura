/** Legacy `DOMException.QUOTA_EXCEEDED_ERR`, still what some engines set as `code`. */
const QUOTA_EXCEEDED_CODE = 22;

const QUOTA_NAMES = new Set(["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"]);

/** Wording engines use when IndexedDB runs out of room without the standard name. */
const QUOTA_MESSAGE = /quota|disk (is )?full|not enough (disk )?space|storage (is )?full/i;

function nameOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) return undefined;
  return typeof error.name === "string" ? error.name : undefined;
}

/**
 * Whether a failed write means the browser is out of room.
 *
 * The standard is a `QuotaExceededError`, but engines differ: Firefox's localStorage says
 * `NS_ERROR_DOM_QUOTA_REACHED`, older ones only set `code` 22, and Safari can abort an IndexedDB
 * transaction with an `UnknownError` whose message talks about the quota. The error may also come
 * wrapped as the `cause` of another.
 */
export function isQuotaExceededError(error: unknown, depth = 0): boolean {
  if (typeof error !== "object" || error === null || depth > 3) return false;
  const name = nameOf(error);
  if (name && QUOTA_NAMES.has(name)) return true;
  if ("code" in error && error.code === QUOTA_EXCEEDED_CODE && error instanceof DOMException) {
    return true;
  }
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  if ((name === "UnknownError" || name === "AbortError") && QUOTA_MESSAGE.test(message)) {
    return true;
  }
  return "cause" in error && isQuotaExceededError(error.cause, depth + 1);
}

/** Share of the origin quota above which a write that failed for no stated reason is "full". */
const FULL_SHARE = 0.95;

/**
 * Whether the origin is (nearly) out of quota, from `navigator.storage.estimate()`. For a write
 * that failed without saying why — an IndexedDB transaction aborted with no error — this tells a
 * full browser from any other failure. False when the browser cannot tell.
 */
export async function isOriginStorageFull(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return false;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return typeof usage === "number" && typeof quota === "number" && quota > 0
      ? usage >= quota * FULL_SHARE
      : false;
  } catch {
    return false;
  }
}
