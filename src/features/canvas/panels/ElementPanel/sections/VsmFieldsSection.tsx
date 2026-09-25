import { useTranslation } from "react-i18next";
import {
  isVsmExternalComponent,
  type Component,
  type ComponentPatch,
  type VsmRole,
} from "@/features/diagram";
import { SegmentedControl } from "../components/SegmentedControl";

export interface VsmFieldsSectionProps {
  component: Component;
  onChange: (patch: ComponentPatch) => void;
}

/** The fields each VSM element carries beyond a name and a description. */
export function VsmFieldsSection({ component, onChange }: VsmFieldsSectionProps) {
  const { t } = useTranslation();

  if (isVsmExternalComponent(component)) {
    return (
      <SegmentedControl<VsmRole>
        label={t("vsm.fields.role")}
        value={component.role ?? "supplier"}
        options={[
          { value: "supplier", label: t("vsm.role.supplier") },
          { value: "customer", label: t("vsm.role.customer") },
        ]}
        // Supplier is the default and is stored as nothing.
        onChange={(role) => onChange({ role: role === "supplier" ? undefined : role })}
      />
    );
  }

  return null;
}
