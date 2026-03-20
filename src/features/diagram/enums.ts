/** Source of a service definition (persisted in ServiceDefinition.sources) */
export enum ServiceSource {
  Github = "github",
  Defectdojo = "defectdojo",
  Manual = "manual",
}

/** Import panel tab in ServiceRegistry (manual, GitHub, DefectDojo) */
export enum ImportPanel {
  Manual = "manual",
  Github = "github",
  Defectdojo = "defectdojo",
}
