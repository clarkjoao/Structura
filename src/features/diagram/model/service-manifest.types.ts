import type { ServiceSourceRef } from "./service.types";

/**
 * Identity of a service as it travels inside an exported diagram.
 *
 * Structura is stateless: every workspace mints its own service ids, so a component's
 * `serviceId` means nothing in the workspace that receives the file. The manifest carries
 * enough independent signals — repository, GitHub repo id, name — for the importing workspace
 * to recognise the same service under its own id.
 */
export interface ServiceManifestEntry {
  /** The id this service had in the exporting workspace, as referenced by the components. */
  id: string;
  name: string;
  repositoryUrl: string;
  technology: string[];
  owner?: string;
  tags?: string[];
  sources?: ServiceSourceRef[];
  github?: {
    repoId: number;
    fullName: string;
  };
}
