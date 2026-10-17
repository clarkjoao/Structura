import type { CommandSectionProvider, SkillCommand } from "../commands/registry";
import { skillFileStem } from "./skill-format";
import { skillKey, type Skill } from "./skill.types";

/** A skill as a `/` menu entry. */
export function skillCommand(skill: Skill): SkillCommand {
  return {
    id: `skill:${skillKey(skill)}`,
    name: skillFileStem(skill.name),
    kind: "skill",
    skill,
  };
}

/** The "Skills" section of the `/` menu: the enabled skills, from every source. */
export const skillsSection: CommandSectionProvider = {
  id: "skills",
  labelKey: "llmChat.skills.section",
  list: (context) => (context.skills ?? []).filter((skill) => skill.enabled).map(skillCommand),
};
