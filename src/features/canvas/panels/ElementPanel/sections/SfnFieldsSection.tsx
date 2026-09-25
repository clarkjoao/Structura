import { useTranslation } from "react-i18next";
import {
  isSfnMapComponent,
  isSfnStateComponent,
  isSfnStateMachineComponent,
  type Component,
  type ComponentPatch,
  type SfnStateType,
} from "@/features/diagram";
import { SFN_SERVICES, sfnStateType } from "@/features/diagram/utils/sfn";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DeployTextField as TextField } from "./DeployTextField";
import { DEPLOY_LABEL_CLASS, positive, text, whole } from "./deployFieldValues";

const STATE_TYPES: readonly SfnStateType[] = [
  "Task",
  "Choice",
  "Wait",
  "Pass",
  "Succeed",
  "Fail",
  "Start",
];
const SELECT_CLASS =
  "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/** The fields each Step Functions element carries beyond a name and a description. */
export function SfnFieldsSection({
  component,
  onChange,
}: {
  component: Component;
  onChange: (patch: ComponentPatch) => void;
}) {
  const { t } = useTranslation();

  if (isSfnStateMachineComponent(component)) {
    return (
      <>
        <div className="space-y-1.5">
          <p className={DEPLOY_LABEL_CLASS}>{t("sfn.fields.workflowType")}</p>
          <select
            aria-label={t("sfn.fields.workflowType")}
            value={component.workflowType ?? "Standard"}
            onChange={(event) =>
              onChange({ workflowType: event.target.value === "Express" ? "Express" : undefined })
            }
            className={SELECT_CLASS}
          >
            <option value="Standard">Standard</option>
            <option value="Express">Express</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sfn-xray">{t("sfn.fields.xray")}</Label>
          <Switch
            id="sfn-xray"
            checked={component.xray === true}
            onCheckedChange={(on) => onChange({ xray: on ? true : undefined })}
          />
        </div>
      </>
    );
  }

  if (isSfnStateComponent(component)) {
    const type = sfnStateType(component);
    return (
      <>
        <div className="space-y-1.5">
          <p className={DEPLOY_LABEL_CLASS}>{t("sfn.fields.stateType")}</p>
          <select
            aria-label={t("sfn.fields.stateType")}
            value={type}
            onChange={(event) => {
              const next = event.target.value as SfnStateType;
              onChange({ stateType: next === "Task" ? undefined : next });
            }}
            className={SELECT_CLASS}
          >
            {STATE_TYPES.map((option) => (
              <option key={option} value={option}>
                {t(`sfn.stateType.${option}`)}
              </option>
            ))}
          </select>
        </div>
        {type === "Task" && (
          <>
            <div className="space-y-1.5">
              <label htmlFor="sfn-service" className={`${DEPLOY_LABEL_CLASS} block`}>
                {t("sfn.fields.service")}
              </label>
              <input
                id="sfn-service"
                list="sfn-service-presets"
                value={component.service ?? ""}
                onChange={(event) => onChange({ service: text(event.target.value) })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              <datalist id="sfn-service-presets">
                {Object.entries(SFN_SERVICES).map(([id, service]) => (
                  <option key={id} value={id}>
                    {service.label}
                  </option>
                ))}
              </datalist>
            </div>
            <TextField
              id="sfn-action"
              label={t("sfn.fields.action")}
              value={component.action}
              onChange={(value) => onChange({ action: text(value) })}
            />
          </>
        )}
        {type === "Wait" && (
          <TextField
            id="sfn-wait"
            type="number"
            label={t("sfn.fields.waitSeconds")}
            value={component.waitSeconds}
            onChange={(value) => onChange({ waitSeconds: whole(value) })}
          />
        )}
        {type === "Fail" && (
          <TextField
            id="sfn-error"
            label={t("sfn.fields.errorName")}
            value={component.errorName}
            onChange={(value) => onChange({ errorName: text(value) })}
          />
        )}
      </>
    );
  }

  if (isSfnMapComponent(component)) {
    return (
      <>
        <TextField
          id="sfn-items"
          label={t("sfn.fields.itemsPath")}
          value={component.itemsPath}
          onChange={(value) => onChange({ itemsPath: text(value) })}
        />
        <TextField
          id="sfn-max"
          type="number"
          label={t("sfn.fields.maxConcurrency")}
          value={component.maxConcurrency}
          onChange={(value) => onChange({ maxConcurrency: positive(value) })}
        />
      </>
    );
  }

  return null;
}
