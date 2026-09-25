import { Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Component, ComponentPatch, SharedMode } from "@/features/diagram";
import { sharedMode } from "@/features/diagram/utils/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MODES: readonly SharedMode[] = ["edges", "badge"];

/**
 * How the edges into this element are drawn. `edges` is today's drawing and
 * is stored as nothing; the edges stay in the model in every mode.
 */
export function SharedModeControl({
  component,
  onChange,
  modes = MODES,
}: {
  component: Component;
  onChange: (patch: ComponentPatch) => void;
  modes?: readonly SharedMode[];
}) {
  const { t } = useTranslation();
  const mode = sharedMode(component);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          title={t("shared.mode.label")}
          aria-label={t("shared.mode.label")}
          aria-pressed={mode !== "edges"}
        >
          <Share2 className={`h-3.5 w-3.5 ${mode !== "edges" ? "text-primary" : ""}`} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onPointerDown={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{t("shared.mode.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) =>
            onChange({ shared: value === "edges" ? undefined : { mode: value as SharedMode } })
          }
        >
          {modes.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {t(`shared.mode.${option}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
