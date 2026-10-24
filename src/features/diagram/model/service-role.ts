import type { ServiceDefinition } from "./service.types";

export const SERVICE_ROLES = ["api", "domain-engine", "worker", "integration"] as const;

export type ServiceRole = (typeof SERVICE_ROLES)[number];

/** `suggested` was inferred by the heuristic; `user` was picked by hand and is never overwritten. */
export type ServiceRoleSource = "suggested" | "user";

export function isServiceRole(value: unknown): value is ServiceRole {
  return typeof value === "string" && (SERVICE_ROLES as readonly string[]).includes(value);
}

/** Name segments (also matched in repository topics) that point at each role. */
const ROLE_KEYWORDS: Record<ServiceRole, readonly string[]> = {
  integration: ["client", "adapter", "integration", "connector"],
  worker: ["worker", "consumer", "job", "cron"],
  api: ["api", "gateway", "bff"],
  "domain-engine": ["engine", "core", "domain"],
};

/** Weak stack hints, used only after the name and the topics found nothing. */
const STACK_HINTS: Record<string, ServiceRole> = {
  lambda: "worker",
  queue: "worker",
  sqs: "worker",
  kafka: "worker",
};

const ROLE_ORDER: readonly ServiceRole[] = ["integration", "worker", "api", "domain-engine"];

function segments(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function matchSegments(parts: string[]): ServiceRole | undefined {
  // The last segment names what the service is (`payments-api`); earlier ones only qualify it.
  const last = parts[parts.length - 1];
  if (last) {
    const byLast = ROLE_ORDER.find((role) => ROLE_KEYWORDS[role].includes(last));
    if (byLast) return byLast;
  }
  return ROLE_ORDER.find((role) => parts.some((part) => ROLE_KEYWORDS[role].includes(part)));
}

/** Role guessed from the service name, its repository name, then its GitHub topics. */
export function suggestServiceRole(
  service: Pick<ServiceDefinition, "name" | "repositoryUrl" | "metadata">,
): ServiceRole | undefined {
  const repoName = service.repositoryUrl
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean)
    .pop();
  const byName = matchSegments(segments(service.name));
  if (byName) return byName;
  if (repoName) {
    const byRepo = matchSegments(segments(repoName));
    if (byRepo) return byRepo;
  }
  const topics = (service.metadata?.github?.topics ?? []).flatMap(segments);
  const byTopic = matchSegments(topics);
  if (byTopic) return byTopic;
  return topics.map((topic) => STACK_HINTS[topic]).find(Boolean);
}

/** The role shown for a service: the declared one, else the suggestion (not persisted). */
export function effectiveServiceRole(service: ServiceDefinition): ServiceRole | undefined {
  return service.role ?? suggestServiceRole(service);
}
