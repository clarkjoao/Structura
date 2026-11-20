import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { useDiagramStore } from "@/features/diagram";
import type { FlowSewNotice } from "@/features/diagram";
import { kindDerivedFlowIds } from "@/features/diagram-kinds/policy";

/**
 * Says out loud when deleting from the canvas changed a flow.
 *
 * Removing a node the script walks through does not just drop that step: the
 * script closes up around it, and the numbers after it shift. That is a change
 * to the user's flow made as a side effect of a different gesture, so it is
 * named — with what left, where the script now joins up, and one action to put
 * both back. Node and step come back together because the removal took a
 * single undo checkpoint covering both.
 */
export function useFlowSewNotices(): void {
  const { t } = useTranslation();
  const batch = useDiagramStore((state) => state._flowSewNotices);
  const shownId = useRef<number | null>(null);

  useEffect(() => {
    if (!batch || batch.id === shownId.current) return;
    shownId.current = batch.id;
    // A flow a diagram kind derives follows the steps by design (ADR-0014):
    // closing it up around a deleted step is the point, not news.
    const state = useDiagramStore.getState();
    const active = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : null;
    const derived = kindDerivedFlowIds(active);
    for (const notice of batch.notices) {
      if (derived.has(notice.flowId)) continue;
      toast.warning(messageFor(notice, t), {
        action: {
          label: t("flowSew.undo"),
          onClick: () => useDiagramStore.getState().undo(),
        },
      });
    }
  }, [batch, t]);
}

function messageFor(notice: FlowSewNotice, t: TFunction): string {
  const element = notice.elementName ?? t("flowSew.unnamedElement");
  const values = {
    element,
    flow: notice.flowName,
    from: notice.fromLabel,
    to: notice.toLabel,
  };
  if (notice.fromLabel !== undefined && notice.toLabel !== undefined) {
    return t("flowSew.sewn", values);
  }
  return t("flowSew.removed", values);
}
