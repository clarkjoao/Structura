import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

/** The banner over the canvas while a version is compared, with the colour key. */
export function CompareModeBanner() {
  const { t } = useTranslation();
  return (
    <div className="absolute top-12 left-1/2 z-20 flex max-w-[min(100vw-2rem,42rem)] -translate-x-1/2 flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs text-muted-foreground shadow-sm sm:flex-row sm:flex-wrap sm:justify-center">
      <div className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{t("canvas.compareViewBanner")}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 shrink-0 rounded-full bg-green-500" aria-hidden />
          {t("compareMode.added")}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 shrink-0 rounded-full bg-red-500" aria-hidden />
          {t("compareMode.removed")}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 shrink-0 rounded-full bg-amber-500" aria-hidden />
          {t("compareMode.modified")}
        </span>
      </div>
    </div>
  );
}
