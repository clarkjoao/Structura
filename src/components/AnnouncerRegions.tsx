import type { RefObject } from "react";

interface AnnouncerRegionsProps {
  /** Ref to the polite (non-interrupting) aria-live region */
  politeRef: RefObject<HTMLDivElement>;
  /** Ref to the assertive (interrupting) aria-live region */
  assertiveRef: RefObject<HTMLDivElement>;
}

/**
 * Renders hidden aria-live regions for screen reader announcements.
 *
 * Must be placed in the component tree (ideally near the root or in a layout
 * component that persists across route changes).
 *
 * @see useAnnouncer hook for making announcements
 */
export function AnnouncerRegions({ politeRef, assertiveRef }: AnnouncerRegionsProps) {
  return (
    <>
      <div
        ref={politeRef as RefObject<HTMLDivElement>}
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      />
      <div
        ref={assertiveRef as RefObject<HTMLDivElement>}
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
      />
    </>
  );
}
