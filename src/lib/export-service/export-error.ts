/**
 * Wraps a failure from a visual exporter in a user-facing message while keeping
 * the original error as `cause` (the ES2020 lib has no `ErrorOptions`).
 */
export function exportError(context: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : "unknown error";
  const error = new Error(`${context}: ${detail}`);
  Object.defineProperty(error, "cause", { value: cause, enumerable: false });
  return error;
}
