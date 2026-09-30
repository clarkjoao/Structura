import { Link2, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useDiagramActions,
  useResolvedNodeLayouts,
  type Component,
  type ComponentPatch,
  type SharedMode,
} from "@/features/diagram";
import { sharedMode } from "@/features/diagram/utils/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MODES: readonly SharedMode[] = ["edges", "badge", "ref"];

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

/**
 * A new reference to the element, beside it: drawn where its consumers are,
 * standing for it everywhere meaning is read. Making one is what makes the
 * element shared; the faster way is Alt+drag, which the title says.
 */
export function CreateRefButton({ original }: { original: Component }) {
  const { t } = useTranslation();
  const layouts = useResolvedNodeLayouts();
  const { addSharedRef } = useDiagramActions();
  const at = layouts[original.id];
  return (
    <button
      type="button"
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      title={t("shared.createRefHint")}
      aria-label={t("shared.createRef")}
      onClick={() =>
        addSharedRef(
          original.id,
          original.parentId,
          at ? { x: at.x + (at.width ?? 200) + 40, y: at.y } : { x: 0, y: 0 },
        )
      }
    >
      <Link2 className="h-3.5 w-3.5" />
    </button>
  );
}
