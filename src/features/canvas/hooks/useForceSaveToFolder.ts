import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { flushWorkspaceToBrowserStorageNow } from "@/features/diagram";
import { forceSaveToConnectedFolder } from "@/infrastructure/persistence";

/**
 * The save shortcut: write the workspace to the connected folder now, falling
 * back to browser storage when there is no folder or the write fails.
 */
export function useForceSaveToFolder(): () => Promise<void> {
  const { t } = useTranslation();
  return useCallback(async () => {
    const fsResult = await forceSaveToConnectedFolder();

    if (fsResult === "ok") {
      toast.success(t("filesystem.savedSuccess"));
      return;
    }

    if (fsResult === "error") {
      toast.error(t("filesystem.saveError"));
      const localOk = await flushWorkspaceToBrowserStorageNow({ force: true });
      if (localOk) {
        toast.success(t("localStorage.savedSuccess"));
      }
      return;
    }

    const localOk = await flushWorkspaceToBrowserStorageNow();
    if (localOk) {
      toast.success(t("localStorage.savedSuccess"));
    }
  }, [t]);
}
