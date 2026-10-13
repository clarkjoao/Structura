import { isAwsComponent, isNoteComponent, isPanelComponent } from "@/features/diagram";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";
import {
  CommandRegistry,
  type ChatCommand,
  type CommandContext,
  type CommandSectionProvider,
} from "./registry";
import { skillsSection } from "../skills/skill-commands";

/**
 * The built-in commands. Instructions are LLM-facing English and are not
 * translated; labels and descriptions are i18n keys.
 */

function components(context: CommandContext) {
  return context.diagram ? Object.values(context.diagram.snapshot.components) : [];
}

/** Elements that are architecture, not annotation. */
function architectureNodeCount(context: CommandContext): number {
  return components(context).filter(
    (component) => !isPanelComponent(component) && !isNoteComponent(component),
  ).length;
}

function hasAws(context: CommandContext): boolean {
  return components(context).some(
    (component) => isAwsComponent(component) || resolveCloudServiceId(component) !== undefined,
  );
}

const review: ChatCommand = {
  id: "review",
  name: "review",
  labelKey: "llmChat.command.review.label",
  descriptionKey: "llmChat.command.review.description",
  kind: "prompt",
  instruction:
    "Review the architecture in the diagram (or the attached elements, if any) for reliability, security, performance, cost, operations and scalability. You may call the read tools first. Answer in Markdown: a short summary, then findings grouped by severity under the headings Critical, High, Medium and Low (omit empty ones), each naming the affected elements, then recommendations, most impactful first. Do not change the diagram unless asked.",
};

const explain: ChatCommand = {
  id: "explain",
  name: "explain",
  labelKey: "llmChat.command.explain.label",
  descriptionKey: "llmChat.command.explain.description",
  kind: "prompt",
  instruction:
    "Explain what the diagram (or the attached elements, if any) does: the role of each main element and how requests and data flow between them. Answer in Markdown, in plain language, without changing the diagram.",
};

const wellArchitected: ChatCommand = {
  id: "well-arch",
  name: "well-arch",
  labelKey: "llmChat.command.wellArch.label",
  descriptionKey: "llmChat.command.wellArch.description",
  kind: "prompt",
  instruction:
    "Evaluate the architecture against the six pillars of the AWS Well-Architected Framework (operational excellence, security, reliability, performance efficiency, cost optimization, sustainability). For each pillar, list the findings that name affected elements, with a severity (Critical, High, Medium, Low) and a concrete recommendation. Answer in Markdown.",
  when: hasAws,
};

const blastRadius: ChatCommand = {
  id: "blast-radius",
  name: "blast-radius",
  labelKey: "llmChat.command.blastRadius.label",
  descriptionKey: "llmChat.command.blastRadius.description",
  kind: "prompt",
  instruction:
    "Assess the blast radius if the attached element fails (if none is attached, the most central component): what breaks directly, what degrades downstream, how users notice, and how to contain it (timeouts, retries, circuit breakers, queues, redundancy). Answer in Markdown.",
  when: (context) => context.selectionIds.length > 0 || architectureNodeCount(context) >= 5,
};

const clear: ChatCommand = {
  id: "clear",
  name: "clear",
  labelKey: "llmChat.command.clear.label",
  descriptionKey: "llmChat.command.clear.description",
  kind: "action",
  run: (context) => context.newConversation(),
};

const copy: ChatCommand = {
  id: "copy",
  name: "copy",
  labelKey: "llmChat.command.copy.label",
  descriptionKey: "llmChat.command.copy.description",
  kind: "action",
  run: (context) => context.copyConversation(),
};

export const BUILT_IN_COMMANDS: readonly ChatCommand[] = [
  review,
  explain,
  wellArchitected,
  blastRadius,
  clear,
  copy,
];

export const commandsSection: CommandSectionProvider = {
  id: "commands",
  labelKey: "llmChat.command.section.commands",
  list: () => BUILT_IN_COMMANDS,
};

export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registry.registerSection(commandsSection);
  registry.registerSection(skillsSection);
  return registry;
}

/** The chat's command registry. */
export const commandRegistry = createCommandRegistry();
