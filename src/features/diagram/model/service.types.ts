export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  technology: string[];
  owner?: string;
  tags?: string[];
  source?: "defectdojo" | "github" | "manual";
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
