import { Input } from "@/components/ui/input";
import { DEPLOY_LABEL_CLASS } from "./deployFieldValues";

/** A labelled text or number field, as the deployment inspectors lay them out. */
export function DeployTextField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={`${DEPLOY_LABEL_CLASS} block`}>
        {label}
      </label>
      <Input
        id={id}
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-9"
      />
    </div>
  );
}
