import type { GithubRepo } from "./github.types";
import type { ServiceDefinition } from "@/features/diagram";

const TECHNOLOGY_TOPICS = new Set<string>([
  "kotlin",
  "java",
  "typescript",
  "python",
  "go",
  "golang",
  "rust",
  "nodejs",
  "node.js",
  "react",
  "nextjs",
  "next.js",
  "nestjs",
  "express",
  "spring",
  "springboot",
  "spring-boot",
  "dotnet",
  ".net",
  "c#",
  "csharp",
  "ruby",
  "rails",
  "php",
  "laravel",
  "django",
  "graphql",
  "mongodb",
  "mysql",
  "postgres",
  "postgresql",
  "docker",
  "kubernetes",
  "terraform",
  "aws",
  "gcp",
  "azure",
  "elixir",
  "phoenix",
  "scala",
  "groovy",
  "haskell",
  "erlang",
  "clojure",
]);

function dedupeInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function githubRepoToService(
  repo: GithubRepo,
): Omit<ServiceDefinition, "id"> {
  const langTech = repo.language ? [repo.language] : [];
  const topicTech = repo.topics.filter((t) => TECHNOLOGY_TOPICS.has(t.toLowerCase()));

  const technology = dedupeInsensitive([...langTech, ...topicTech]);

  return {
    name: repo.name,
    description: repo.description ?? "",
    repositoryUrl: repo.html_url,
    technology,
    tags: repo.topics,
    source: "github",
    sourceId: repo.full_name,
    metadata: {
      github: {
        repoId: repo.id,
        fullName: repo.full_name,
        topics: repo.topics,
        language: repo.language,
        updatedAt: repo.updated_at,
      },
    },
  };
}

