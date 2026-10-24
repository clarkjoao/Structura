import { ServiceSource } from "@/features/diagram";
import type { GroupBy } from "./types";

export function sourceTypeLabel(t: (key: string) => string, type: ServiceSource): string {
  switch (type) {
    case ServiceSource.Manual:
      return t("services.sourceManual");
    case ServiceSource.Github:
      return t("services.sourceGithub");
    case ServiceSource.Gitlab:
      return t("services.sourceGitlab");
    case ServiceSource.Defectdojo:
      return t("services.sourceDefectdojo");
    default:
      return String(type);
  }
}

type Translate = (key: string) => string;

/** Heading of a catalog group; technologies are shown as they are written. */
export function groupLabel(t: Translate, groupBy: GroupBy, key: string): string {
  if (key === "none") return t(`services.none.${groupBy}`);
  if (groupBy === "role") return t(`services.role.${key}`);
  if (groupBy === "source") return sourceTypeLabel(t, key as ServiceSource);
  return key;
}

/** One short phrase under a role heading; other groupings have none. */
export function groupHint(t: Translate, groupBy: GroupBy, key: string): string {
  return groupBy === "role" && key !== "none" ? t(`services.roleHint.${key}`) : "";
}
