import { useTranslation } from "react-i18next";
import { type ComponentPatch } from "@/features/diagram";
import type { ElementInspectorProps } from "@/features/elements/element.types";
import { CommitField, ElementScaffold, PanelSection } from "./shell";
import { DeployFieldsSection } from "./sections/DeployFieldsSection";
import { K8sFieldsSection } from "./sections/K8sFieldsSection";
import { ELEMENT_SIZE_LIMITS } from "@/features/canvas/nodes/elementSizeLimits";

/**
 * The inspector for every skinned element (deployment, Kubernetes structure):
 * name and description, the fields that element carries, and the flow skin's
 * Appearance section with the element's own default accent.
 */
export default function SkinnedElementPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger = 0,
  onFocusElement,
}: ElementInspectorProps) {
  const { t } = useTranslation();
  const update = (patch: ComponentPatch) => updateComponent(component.id, patch);

  return (
    <ElementScaffold
      component={component}
      onClose={onClose}
      updateComponent={updateComponent}
      removeComponent={removeComponent}
      onFocusElement={onFocusElement}
      focusTitleTrigger={focusTitleTrigger}
      sizable
      {...ELEMENT_SIZE_LIMITS[component.type]}
    >
      <PanelSection title={t("panelShell.sectionWhat")}>
        <CommitField
          label={t("common.description")}
          value={component.description}
          multiline
          addLabel={t("panelShell.addDescription")}
          onCommit={(value) => update({ description: value })}
        />
        <DeployFieldsSection component={component} onChange={update} />
        <K8sFieldsSection component={component} onChange={update} />
      </PanelSection>
    </ElementScaffold>
  );
}
