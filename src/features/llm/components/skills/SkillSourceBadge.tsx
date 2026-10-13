import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SKILL_SOURCE_LABEL_KEYS, type SkillSource } from "../../skills/skill.types";

/** Where a skill comes from: "Workspace" or "Local". Shown wherever a skill appears. */
export function SkillSourceBadge({
  source,
  className,
}: {
  source: SkillSource;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border border-border px-1 text-[10px] font-medium leading-4 text-muted-foreground",
        className,
      )}
    >
      {t(SKILL_SOURCE_LABEL_KEYS[source])}
    </span>
  );
}
