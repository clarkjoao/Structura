import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { ComponentType } from "@/features/diagram";
import { cloudRegistry } from "@/features/cloud/registry/cloud.registry";
import { PANEL_INPUT_CLASS, PANEL_LABEL_CLASS } from "../shell/fieldStyles";

interface ElementTypeSelectProps {
  /** The shared type; null when a selection mixes several (shown as "Mixed"). */
  value: ComponentType | null;
  onChange: (type: ComponentType) => void;
  mixedLabel?: string;
}

const MIXED = "__mixed__";

/** The C4 and cloud-category type picker, for one element or a whole selection. */
export function ElementTypeSelect({ value, onChange, mixedLabel }: ElementTypeSelectProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={PANEL_LABEL_CLASS}>
        {t("endpointPanel.type")}
      </label>
      <select
        id={id}
        value={value ?? MIXED}
        onChange={(event) => {
          if (event.target.value !== MIXED) onChange(event.target.value as ComponentType);
        }}
        className={PANEL_INPUT_CLASS}
      >
        {value === null && (
          <option value={MIXED} disabled>
            {mixedLabel}
          </option>
        )}
        <optgroup label={t("elementPanel.c4ModelGroup")}>
          <option value="person">{t("colors.c4Person")}</option>
          <option value="system">{t("colors.c4System")}</option>
          <option value="container">{t("colors.c4Container")}</option>
          <option value="component">{t("colors.c4Component")}</option>
        </optgroup>
        {cloudRegistry.allProviders().flatMap((provider) =>
          provider.categories.map((category) => (
            <optgroup
              key={`${provider.id}-${category.id}`}
              label={t("endpointPanel.cloudCategory", {
                provider: provider.name,
                name: category.name,
              })}
            >
              <option value={category.id}>{category.name}</option>
            </optgroup>
          )),
        )}
      </select>
    </div>
  );
}
