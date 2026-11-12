import { useSharedRefNotices } from "../shared/useSharedRefNotices";
import { useFlowSewNotices } from "../flow/useFlowSewNotices";
import type { CanvasVisualState } from "../hooks/useCanvasVisualState";
import { useServiceFocusFromUrl } from "../hooks/useServiceFocusFromUrl";
import { useElementFocusFromUrl } from "../hooks/useElementFocusFromUrl";

/** The toasts the editor canvas raises about side effects of an edit: a flow sewn up, a shared reference. */
export function useCanvasNotices(): void {
  useFlowSewNotices();
  useSharedRefNotices();
}

/** Focus what the URL names when the canvas opens: a service (`?serviceId=`), an element (`?nodeId=`). */
export function useCanvasFocusFromUrl(visualState: CanvasVisualState): void {
  useServiceFocusFromUrl(visualState);
  useElementFocusFromUrl(visualState);
}
