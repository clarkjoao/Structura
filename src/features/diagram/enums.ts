export enum ServiceSource {
  Github = "github",
  Defectdojo = "defectdojo",
  Manual = "manual",
}

export enum ImportPanel {
  Manual = "manual",
  Github = "github",
  Defectdojo = "defectdojo",
}

export enum EdgeStyle {
  Bezier = "bezier",
  Smoothstep = "smoothstep",
  Step = "step",
  Straight = "straight",
}

export enum StrokeStyle {
  Solid = "solid",
  Dashed = "dashed",
  Dotted = "dotted",
}

export enum EdgeMarker {
  None = "none",
  Arrow = "arrow",
  ArrowClosed = "arrowclosed",
}

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

export enum ExternalLinkType {
  Confluence = "confluence",
  Github = "github",
  Jira = "jira",
  Generic = "generic",
}

export enum FileSystemEntryKind {
  File = "file",
  Directory = "directory",
}
