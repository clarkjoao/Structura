import { useTranslation } from "react-i18next";
import type { CanvasPickerOption } from "./types";
import { PICKER_CARD_CLASS } from "./constants";
import { PickerSectionHeader } from "./PickerSectionHeader";

export function FlowchartCategoryView({
  options,
  onAdd,
}: {
  options: CanvasPickerOption[];
  onAdd: (opt: CanvasPickerOption) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <PickerSectionHeader sectionLabel={t("elementPicker.flowchart")} />
      <div className="grid grid-cols-3 gap-2 px-3">
        {options.map((opt) => (
          <button
            key={opt.flowShape}
            type="button"
            onClick={() => onAdd(opt)}
            className={PICKER_CARD_CLASS}
          >
            <opt.icon className="h-8 w-8 shrink-0 text-muted-foreground" />
            <span className="mt-1.5 text-center text-xs leading-tight text-foreground">
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
