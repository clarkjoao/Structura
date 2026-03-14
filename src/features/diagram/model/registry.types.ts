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
  metadata?: Record<string, unknown>;
}
