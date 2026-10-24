import { SERVICE_ROLES } from "@/features/diagram";
import type { ServiceRole } from "@/features/diagram";
import { useTranslation } from "react-i18next";

interface RoleSelectProps {
  /** Empty string means "no role declared": the suggestion applies. */
  value: ServiceRole | "";
  suggested?: ServiceRole;
  onChange: (value: ServiceRole | "") => void;
}

export const RoleSelect = ({ value, suggested, onChange }: RoleSelectProps) => {
  const { t } = useTranslation();
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("services.roleLabel")}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ServiceRole | "")}
        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">
          {suggested
            ? t("services.roleSuggested", { role: t(`services.role.${suggested}`) })
            : t("services.role.none")}
        </option>
        {SERVICE_ROLES.map((role) => (
          <option key={role} value={role}>
            {t(`services.role.${role}`)}
          </option>
        ))}
      </select>
    </div>
  );
};
