export type RepoKind = "github" | "gitlab";

export interface ParsedRepoUrl {
  host: string;
  /** Full repository path without `.git`: `org/repo`, or `group/sub/repo` on GitLab. */
  path: string;
  /** Canonical https URL of the repository page. */
  webUrl: string;
  /** Source recognised from the host; `undefined` for a host we do not know. */
  kind: RepoKind | undefined;
}

export interface KnownHosts {
  github?: readonly string[];
  gitlab?: readonly string[];
}

const DEFAULT_HOSTS: Required<KnownHosts> = {
  github: ["github.com"],
  gitlab: ["gitlab.com"],
};

/** Host of an API or web base URL, for registering a self-hosted instance as known. */
export function hostOf(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) return undefined;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`).host
      .toLowerCase()
      .replace(/^api\./, "");
  } catch {
    return undefined;
  }
}

function splitLocation(input: string): { host: string; rest: string } | undefined {
  // scp-like SSH: git@host:group/repo.git
  const scp = /^[\w.-]+@([^:/\s]+):(?!\/\/)(.+)$/.exec(input);
  if (scp) return { host: scp[1], rest: scp[2] };

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(withScheme);
    // `ssh://git@host:7999/...` carries a port that is not part of the web host.
    const host = url.protocol === "ssh:" ? url.hostname : url.host;
    return { host, rest: url.pathname };
  } catch {
    return undefined;
  }
}

/**
 * Reads a repository location pasted by the user: https, scheme-less, or SSH, with or without
 * `.git`, a trailing slash, or a browser path such as `/tree/main` or GitLab's `/-/...`.
 * Returns `undefined` when it does not name a `host/owner/repo`.
 */
export function parseRepoUrl(raw: string, known: KnownHosts = {}): ParsedRepoUrl | undefined {
  const input = raw.trim();
  if (!input) return undefined;
  const location = splitLocation(input);
  if (!location) return undefined;

  const host = location.host.toLowerCase().replace(/^www\./, "");
  const kind = hostKind(host, known);

  const cleaned = location.rest.split(/[?#]/)[0];
  let segments = cleaned.split("/").filter(Boolean);
  const dash = segments.indexOf("-");
  if (dash >= 0) segments = segments.slice(0, dash);
  // GitHub nests nothing under owner/repo, so everything after is a page of the repo.
  if (kind === "github") segments = segments.slice(0, 2);
  if (segments.length < 2) return undefined;

  segments[segments.length - 1] = segments[segments.length - 1].replace(/\.git$/i, "");
  if (segments.some((segment) => !segment)) return undefined;

  const path = segments.join("/");
  return { host, path, webUrl: `https://${host}/${path}`, kind };
}

function hostKind(host: string, known: KnownHosts): RepoKind | undefined {
  const github = [...DEFAULT_HOSTS.github, ...(known.github ?? [])];
  const gitlab = [...DEFAULT_HOSTS.gitlab, ...(known.gitlab ?? [])];
  if (github.includes(host)) return "github";
  if (gitlab.includes(host)) return "gitlab";
  return undefined;
}
