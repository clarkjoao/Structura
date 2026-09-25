import { useTranslation } from "react-i18next";
import {
  isSfnMapComponent,
  isSfnParallelComponent,
  isSfnStateComponent,
  isSfnStateMachineComponent,
  type Component,
  type ComponentPatch,
  type SfnRetry,
  type SfnStateType,
} from "@/features/diagram";
import { SFN_SERVICES, sfnStateType } from "@/features/diagram/utils/sfn";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DeployTextField as TextField } from "./DeployTextField";
import { DEPLOY_LABEL_CLASS, list, positive, text, whole } from "./deployFieldValues";

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

/**
 * A state's first retrier — what its badge says. Switching it on stores an
 * empty retrier (ASL's defaults); the others, if any, are kept as they are.
 */
function RetryFields({
  retry,
  onChange,
}: {
  retry: SfnRetry[] | undefined;
  onChange: (patch: ComponentPatch) => void;
}) {
  const { t } = useTranslation();
  const first = retry?.[0];
  const setFirst = (patch: Partial<SfnRetry>) => {
    const next = { ...first, ...patch };
    for (const key of Object.keys(next) as (keyof SfnRetry)[]) {
      if (next[key] === undefined) delete next[key];
    }
    onChange({ retry: [next, ...(retry ?? []).slice(1)] });
  };
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="sfn-retry">{t("sfn.fields.retry")}</Label>
        <Switch
          id="sfn-retry"
          checked={first !== undefined}
          onCheckedChange={(on) => onChange({ retry: on ? [{}] : undefined })}
        />
      </div>
      {first && (
        <>
          <TextField
            id="sfn-retry-errors"
            label={t("sfn.fields.retryErrors")}
            value={first.errors?.join(", ")}
            onChange={(value) => setFirst({ errors: list(value) })}
          />
          <div className="grid grid-cols-3 gap-2">
            <TextField
              id="sfn-retry-max"
              type="number"
              label={t("sfn.fields.maxAttempts")}
              value={first.maxAttempts}
              onChange={(value) => setFirst({ maxAttempts: whole(value) })}
            />
            <TextField
              id="sfn-retry-backoff"
              type="number"
              label={t("sfn.fields.backoffRate")}
              value={first.backoffRate}
              onChange={(value) => setFirst({ backoffRate: positive(value) })}
            />
            <TextField
              id="sfn-retry-interval"
              type="number"
              label={t("sfn.fields.intervalSeconds")}
              value={first.intervalSeconds}
              onChange={(value) => setFirst({ intervalSeconds: positive(value) })}
            />
          </div>
        </>
      )}
    </>
  );
}

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
            <RetryFields retry={component.retry} onChange={onChange} />
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
        <RetryFields retry={component.retry} onChange={onChange} />
      </>
    );
  }

  if (isSfnParallelComponent(component)) {
    return <RetryFields retry={component.retry} onChange={onChange} />;
  }

  return null;
}
