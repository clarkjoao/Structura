/**
 * A skill: a named, reusable instruction pack the user activates from the `/`
 * menu. Name, description and instructions are user data — never translated.
 */

export type SkillSource = "workspace" | "local";

export interface Skill {
  /** Stable per source: the file path for workspace skills, a generated id for local ones. */
  id: string;
  source: SkillSource;
  name: string;
  /** "When to use". */
  description: string;
  instructions: string;
  /** Tool registry names the skill may use; absent means every tool. */
  tools?: string[];
  enabled: boolean;
  /** Workspace skills only: the file path inside the workspace folder. */
  path?: string;
}

/** The fields a skill file holds; source, id and enabled state live outside the file. */
export type SkillFields = Pick<Skill, "name" | "description" | "instructions" | "tools">;

/**
 * What a user message stores about a skill that was active when it was sent.
 * `name` is cached for display; the skill itself is looked up by source and id
 * when a request is built.
 */
export interface SkillRef {
  id: string;
  source: SkillSource;
  name: string;
}

const SKILL_SOURCES: readonly SkillSource[] = ["workspace", "local"];

export function isSkillSource(value: unknown): value is SkillSource {
  return SKILL_SOURCES.some((source) => source === value);
}

export function isWorkspaceSkill(skill: Skill): skill is Skill & { source: "workspace" } {
  return skill.source === "workspace";
}

export function isLocalSkill(skill: Skill): skill is Skill & { source: "local" } {
  return skill.source === "local";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSkillRef(value: unknown): value is SkillRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isSkillSource(value.source)
  );
}

/** One key per skill across sources: the same id may exist in both. */
export function skillKey(skill: Pick<Skill, "source" | "id">): string {
  return `${skill.source}:${skill.id}`;
}

export function toSkillRef(skill: Skill): SkillRef {
  return { id: skill.id, source: skill.source, name: skill.name };
}

/** Per-source presentation, so nothing switches on the source string. */
export const SKILL_SOURCE_LABEL_KEYS: Record<SkillSource, string> = {
  workspace: "llmChat.skills.source.workspace",
  local: "llmChat.skills.source.local",
};
