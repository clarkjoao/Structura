import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useSaveStatusStore } from "@/features/diagram/store/saveStatus.store";

const HIDE_DELAY_MS = 2500;

export function SaveStatusIndicator() {
  const { t } = useTranslation();
  const status = useSaveStatusStore((state) => state.status);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "pending" || status === "error") {
      setVisible(true);
      return;
    }

    if (status === "saved") {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
      return () => clearTimeout(timer);
    }

    setVisible(false);
  }, [status]);

  if (!visible) return null;

  return (
    <div
      className="flex items-center gap-1.5 select-none text-xs text-muted-foreground"
      aria-live="polite"
      aria-label={
        status === "pending"
          ? t("canvas.saving")
          : status === "saved"
            ? t("canvas.saved")
            : t("canvas.saveError")
      }
    >
      {status === "pending" ? (
        <>
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
          <span>{t("canvas.saving")}</span>
        </>
      ) : null}
      {status === "saved" ? (
        <>
          <Check className="h-3 w-3 shrink-0 text-green-500" aria-hidden />
          <span>{t("canvas.saved")}</span>
        </>
      ) : null}
      {status === "error" ? (
        <>
          <AlertCircle className="h-3 w-3 shrink-0 text-destructive" aria-hidden />
          <span>{t("canvas.saveError")}</span>
        </>
      ) : null}
    </div>
  );
}
