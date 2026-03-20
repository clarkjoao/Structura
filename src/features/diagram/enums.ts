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

/** Edge path style (persisted in Connection.style.edgeStyle) */
export enum EdgeStyle {
  Bezier = "bezier",
  Smoothstep = "smoothstep",
  Step = "step",
  Straight = "straight",
}

/** Connection stroke style (persisted in Connection.style.strokeStyle) */
export enum StrokeStyle {
  Solid = "solid",
  Dashed = "dashed",
  Dotted = "dotted",
}

/** Edge marker (arrow) style (persisted in Connection.style.markerEnd/markerStart) */
export enum EdgeMarker {
  None = "none",
  Arrow = "arrow",
  ArrowClosed = "arrowclosed",
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
