export type ServiceSourceType = "defectdojo" | "github" | "manual";

export interface ServiceSourceRef {
  type: ServiceSourceType;
  sourceId?: string;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  technology: string[];
  owner?: string;
  tags?: string[];
  sources?: ServiceSourceRef[];
  /** @deprecated Legacy single-source field kept for migration compatibility. */
  source?: ServiceSourceType;
  /** @deprecated Legacy single-source field kept for migration compatibility. */
  sourceId?: string;
  metadata?: {
    github?: {
      repoId: number;
      fullName: string;
      topics: string[];
      language: string | null;
      updatedAt: string;
    };
    // Preserve existing DefectDojo data when merging into GitHub services.
    defectdojo?: Record<string, unknown>;
  };
}
