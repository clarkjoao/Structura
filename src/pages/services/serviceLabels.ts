import { ServiceSource } from "@/features/diagram";

export function sourceTypeLabel(t: (key: string) => string, type: ServiceSource): string {
  switch (type) {
    case ServiceSource.Manual:
      return t("services.sourceManual");
    case ServiceSource.Github:
      return t("services.sourceGithub");
    case ServiceSource.Defectdojo:
      return t("services.sourceDefectdojo");
    default:
      return String(type);
  }
}
