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

/** Panel kind for infrastructure grouping (persisted in PanelComponent.panelKind) */
export enum PanelKind {
  Default = "default",
  AvailabilityZone = "availability-zone",
  EksCluster = "eks-cluster",
  EcsCluster = "ecs-cluster",
  AutoScalingGroup = "auto-scaling-group",
  Vpc = "vpc",
  PublicSubnet = "public-subnet",
  PrivateSubnet = "private-subnet",
  Swimlane = "swimlane",
}
