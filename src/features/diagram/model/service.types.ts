import type { ServiceSource } from "../enums";
import type { ServiceRole, ServiceRoleSource } from "./service-role";

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
  /** What the service does in the architecture; see `suggestServiceRole`. */
  role?: ServiceRole;
  /** `user` once the role was picked by hand: suggestions and syncs never overwrite it. */
  roleSource?: ServiceRoleSource;
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
