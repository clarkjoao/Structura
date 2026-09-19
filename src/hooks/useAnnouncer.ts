import { useCallback, useRef } from "react";

export type AnnouncementPriority = "polite" | "assertive";

/**
 * Hook for announcing messages to screen readers via aria-live regions.
 *
 * Usage:
 * ```tsx
 * const { announce, politeRef, assertiveRef } = useAnnouncer();
 *
 * // Announce a message (defaults to polite)
 * announce("Selection changed to " + elementName);
 *
 * // Announce urgently (interrupts current speech)
 * announce("Error: " + errorMessage, "assertive");
 * ```
 *
 * The refs must be passed to AnnouncerRegions component:
 * ```tsx
 * <AnnouncerRegions politeRef={politeRef} assertiveRef={assertiveRef} />
 * ```
 */
export function useAnnouncer() {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  const announce = useCallback(
    (message: string, priority: AnnouncementPriority = "polite") => {
      const region = priority === "assertive" ? assertiveRef : politeRef;
      if (!region.current) return;

      // Clear and re-set to ensure screen reader picks up the change
      region.current.textContent = "";
      requestAnimationFrame(() => {
        if (region.current) {
          region.current.textContent = message;
        }
      });
    },
    [],
  );

  return { announce, politeRef, assertiveRef };
}
