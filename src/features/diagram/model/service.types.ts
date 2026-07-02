import type { ServiceSource } from "../enums";

export interface ServiceSourceRef {
  type: ServiceSource;
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

  source?: ServiceSource;

  sourceId?: string;
  externalLinks?: import("./component.types").ExternalLink[];
  metadata?: {
    github?: {
      repoId: number;
      fullName: string;
      topics: string[];
      language: string | null;
      updatedAt: string;
    };

    defectdojo?: Record<string, unknown>;
  };
}
