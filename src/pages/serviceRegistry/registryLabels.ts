import { ServiceSource } from "@/features/diagram";

export function sourceTypeLabel(
  t: (key: string) => string,
  type: ServiceSource,
): string {
  switch (type) {
    case ServiceSource.Manual:
      return t("registry.sourceManual");
    case ServiceSource.Github:
      return t("registry.sourceGithub");
    case ServiceSource.Defectdojo:
      return t("registry.sourceDefectdojo");
    default:
      return String(type);
  }
}
