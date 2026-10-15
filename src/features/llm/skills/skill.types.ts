/**
 * A skill: a named, reusable instruction pack the user activates from the `/`
 * menu. Name, description and instructions are user data — never translated.
 */

/** `builtin` skills ship with the app and are read-only. */
export type SkillSource = "workspace" | "local" | "builtin";

export interface Skill {
  /**
   * Stable per source: the file path for workspace skills, a generated id for
   * local ones, the file name for built-in ones.
   */
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

const SKILL_SOURCES: readonly SkillSource[] = ["workspace", "local", "builtin"];

export function isSkillSource(value: unknown): value is SkillSource {
  return SKILL_SOURCES.some((source) => source === value);
}

export function isWorkspaceSource(source: SkillSource): source is "workspace" {
  return source === "workspace";
}

export function isWorkspaceSkill(skill: Skill): skill is Skill & { source: "workspace" } {
  return skill.source === "workspace";
}

export function isLocalSkill(skill: Skill): skill is Skill & { source: "local" } {
  return skill.source === "local";
}

/** Built-in skills ship with the app: they can be turned off and exported, not edited. */
export function isBuiltinSkill(skill: Pick<Skill, "source">): boolean {
  return skill.source === "builtin";
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
  builtin: "llmChat.skills.source.builtin",
};

/** i18n key for the tool summary: "N tools" when the skill restricts tools, "all tools" otherwise. */
export function skillToolsLabelKey(skill: Pick<Skill, "tools">): string {
  return skill.tools && skill.tools.length > 0
    ? "llmChat.skills.toolCount"
    : "llmChat.skills.allTools";
}
