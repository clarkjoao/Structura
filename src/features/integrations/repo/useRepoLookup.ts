import { useEffect, useState } from "react";
import { useGithubConfig } from "../github/hooks/useGithubConfig";
import { useGitlabConfig } from "../gitlab/useGitlabConfig";
import type { ParsedRepoUrl, RepoKind } from "./parseRepoUrl";
import { fetchRepoMetadata, NoConfigForHostError } from "./repoLookup";
import type { RepoMetadata } from "./repo.types";

export type RepoLookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; metadata: RepoMetadata }
  | { status: "error"; reason: "not-found" | "no-config" | "other"; message: string };

const DEBOUNCE_MS = 450;

function classify(error: unknown): RepoLookupState {
  if (error instanceof NoConfigForHostError) {
    return { status: "error", reason: "no-config", message: error.host };
  }
  const message = error instanceof Error ? error.message : String(error);
  // 404 is also what a private repository answers when the token cannot see it.
  const reason = /\b(404|403|401)\b/.test(message) ? "not-found" : "other";
  return { status: "error", reason, message };
}

/**
 * Reads the metadata of the repository being typed, after the user pauses. Each new location
 * discards the answer of the one before it, so a slow response never lands on a newer URL.
 */
export function useRepoLookup(
  parsed: ParsedRepoUrl | undefined,
  kind: RepoKind | undefined,
): RepoLookupState {
  const { config: github } = useGithubConfig();
  const { config: gitlab } = useGitlabConfig();
  const [state, setState] = useState<RepoLookupState>({ status: "idle" });
  const target = parsed && kind ? `${kind}:${parsed.host}/${parsed.path}` : "";

  useEffect(() => {
    if (!parsed || !kind) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      fetchRepoMetadata(kind, parsed, { github, gitlab })
        .then((metadata) => !cancelled && setState({ status: "ready", metadata }))
        .catch((error: unknown) => !cancelled && setState(classify(error)));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `target` stands for parsed+kind; the configs only matter when they change what is fetched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, github, gitlab]);

  return state;
}
