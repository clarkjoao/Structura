import { useEffect } from "react";
import { consumeImportPayload } from "@/lib/embed-url";
import type { Diagram } from "@/features/diagram";

/**
 * Drop this hook into your app's root component (or router entry point).
 *
 * When `VITE_EMBED_ROUTING_BYPASS=true` and the URL contains `?import=<b64>`,
 * it waits for the app to mount, then calls `onDiagram` with the decoded
 * Diagram so your import flow can take over (open modal, load into editor, etc).
 *
 * Safe no-op when bypass is disabled or no payload is present.
 *
 * @example
 * // In your root App component or router layout:
 * useImportPayload((diagram) => {
 *   openImportModal(diagram);
 * });
 */
export function useImportPayload(onDiagram: (diagram: Diagram) => void): void {
  useEffect(() => {
    const cleanup = consumeImportPayload(onDiagram as (d: unknown) => void);
    return cleanup;
    // onDiagram is intentionally excluded — we only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}