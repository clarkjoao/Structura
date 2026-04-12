export function isQuotaExceededError(err: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")) ||
    (err instanceof Error && err.name === "QuotaExceededError")
  );
}
