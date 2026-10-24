import type { RepoKind } from "./parseRepoUrl";

/** What the single-URL form reads from a repository, whichever the source. */
export interface RepoMetadata {
  kind: RepoKind;
  name: string;
  description: string;
  webUrl: string;
  /** `owner/repo` or the GitLab group path; also the source id kept on the service. */
  fullName: string;
  /** Numeric id on the source, kept to recognise the repository after a rename. */
  remoteId: number;
  languages: string[];
  topics: string[];
  updatedAt: string;
}
