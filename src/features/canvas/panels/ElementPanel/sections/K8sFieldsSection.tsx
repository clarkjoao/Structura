import { useTranslation } from "react-i18next";
import {
  isK8sClusterComponent,
  isK8sNamespaceComponent,
  type Component,
  type ComponentPatch,
} from "@/features/diagram";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DeployTextField as TextField } from "./DeployTextField";
import { positive, text } from "./deployFieldValues";

/** The fields each Kubernetes structural element carries beyond a name and a description. */
export function K8sFieldsSection({
  component,
  onChange,
}: {
  component: Component;
  onChange: (patch: ComponentPatch) => void;
}) {
  const { t } = useTranslation();

  if (isK8sClusterComponent(component)) {
    return (
      <>
        <TextField
          id="k8s-distribution"
          label={t("k8s.fields.distribution")}
          value={component.distribution}
          onChange={(value) => onChange({ distribution: text(value) })}
        />
        <TextField
          id="k8s-version"
          label={t("k8s.fields.version")}
          value={component.version}
          onChange={(value) => onChange({ version: text(value) })}
        />
        <TextField
          id="k8s-nodes"
          type="number"
          label={t("k8s.fields.nodeCount")}
          value={component.nodeCount}
          onChange={(value) => onChange({ nodeCount: positive(value) })}
        />
        <TextField
          id="k8s-zones"
          type="number"
          label={t("k8s.fields.zoneCount")}
          value={component.zoneCount}
          onChange={(value) => onChange({ zoneCount: positive(value) })}
        />
      </>
    );
  }

  if (isK8sNamespaceComponent(component)) {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="k8s-mesh">{t("k8s.fields.meshInjection")}</Label>
        <Switch
          id="k8s-mesh"
          checked={component.meshInjection === true}
          onCheckedChange={(on) => onChange({ meshInjection: on ? true : undefined })}
        />
      </div>
    );
  }

  return null;
}
