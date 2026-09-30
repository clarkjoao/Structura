import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDiagramStore } from "@/features/diagram";

/**
 * Says so when deleting a shared element took its references with it, with
 * one action to put all of it back (the removal was a single undo step).
 */
export function useSharedRefNotices(): void {
  const { t } = useTranslation();
  const notice = useDiagramStore((state) => state._sharedRefNotice);
  const shownId = useRef<number | null>(null);

  useEffect(() => {
    if (!notice || notice.id === shownId.current) return;
    shownId.current = notice.id;
    toast.warning(t("shared.refsRemoved", { count: notice.count, name: notice.name }), {
      action: { label: t("flowSew.undo"), onClick: () => useDiagramStore.getState().undo() },
    });
  }, [notice, t]);
}
