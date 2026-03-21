import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ServiceDefinition } from "@/features/diagram";
import { registrySourceDotClass } from "./elementPickerModal.utils";

type Variant = "default" | "search";

export function RegistryServiceRow({
  svc,
  isOnCanvas,
  onAdd,
  variant = "default",
}: {
  svc: ServiceDefinition;
  isOnCanvas: boolean;
  onAdd: () => void;
  variant?: Variant;
}) {
  const { t } = useTranslation();
  const tech = svc.technology[0] ?? "";
  const btnClass =
    variant === "search"
      ? "shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-hover"
      : "shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/40 px-3 py-2">
      <div className={cn("h-2 w-2 shrink-0 rounded-full", registrySourceDotClass(svc))} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground text-sm">{svc.name}</p>
        {tech && (
          <p className="truncate text-xs text-muted-foreground">{tech}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className={btnClass}
        title={t("elementPicker.addAnotherInstance")}
      >
        {isOnCanvas ? (
          <span
            className={cn(
              "inline-flex items-center text-emerald-600 dark:text-emerald-400",
              variant === "default" && "gap-1",
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : (
          t("elementPicker.addButton")
        )}
      </button>
    </div>
  );
}
