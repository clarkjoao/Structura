import type { Diagram } from "@/features/diagram";
import type { Skill } from "../skills/skill.types";

/** What a command can look at to decide whether it is worth suggesting. */
export interface CommandContext {
  diagram: Diagram | null;
  selectionIds: readonly string[];
  /** The user's skills, for the Skills section; absent lists none. */
  skills?: readonly Skill[];
}

/** What an action command can do; provided by the chat panel. */
export interface CommandActionContext {
  /** Starts a new conversation; the current one stays in history. */
  newConversation: () => void;
  /** Copies the whole conversation as Markdown. */
  copyConversation: () => Promise<void>;
}

interface CommandBase {
  id: string;
  /** The `/name` token, without the slash. */
  name: string;
  /**
   * Extra `/name` tokens that resolve to this command. The `/` menu only
   * shows `name`; aliases exist so users can type `/new` or `/clean` and get
   * the same action as `/clear`.
   */
  aliases?: string[];
  /** Whether to suggest the command for this context; absent means always. */
  when?: (context: CommandContext) => boolean;
}

/** A built-in command: its label and description are i18n keys. */
interface BuiltInCommandBase extends CommandBase {
  labelKey: string;
  descriptionKey: string;
}

/** Sends a turn: the model receives `instruction` (English), the user's text and the context. */
export interface PromptCommand extends BuiltInCommandBase {
  kind: "prompt";
  instruction: string;
}

/** Does something in the chat instead of sending a turn. */
export interface ActionCommand extends BuiltInCommandBase {
  kind: "action";
  run: (context: CommandActionContext) => void | Promise<void>;
}

/**
 * Activates a skill: choosing it adds a sticky skill chip to the composer.
 * The skill's name and description are user data, shown as written.
 */
export interface SkillCommand extends CommandBase {
  kind: "skill";
  skill: Skill;
}

export type ChatCommand = PromptCommand | ActionCommand | SkillCommand;

export function isPromptCommand(command: ChatCommand): command is PromptCommand {
  return command.kind === "prompt";
}

export function isActionCommand(command: ChatCommand): command is ActionCommand {
  return command.kind === "action";
}

export function isSkillCommand(command: ChatCommand): command is SkillCommand {
  return command.kind === "skill";
}

/** What the menu shows and searches as the command's label. */
export function commandLabel(command: ChatCommand, translate: (key: string) => string): string {
  return isSkillCommand(command) ? command.skill.name : translate(command.labelKey);
}

/** A group of commands in the `/` menu, e.g. the built-ins or the user's skills. */
export interface CommandSectionProvider {
  id: string;
  /** i18n key of the section header. */
  labelKey: string;
  list: (context: CommandContext) => readonly ChatCommand[];
}

export interface CommandSection {
  id: string;
  labelKey: string;
  commands: ChatCommand[];
}

const EMPTY_CONTEXT: CommandContext = { diagram: null, selectionIds: [] };

export class CommandRegistry {
  private readonly providers: CommandSectionProvider[] = [];

  registerSection(provider: CommandSectionProvider): void {
    if (this.providers.some((existing) => existing.id === provider.id)) {
      throw new Error(`A command section named "${provider.id}" is already registered`);
    }
    this.providers.push(provider);
  }

  /**
   * Sections for the `/` menu: every command whose name or translated label
   * contains `query`, name-prefix matches first. Empty sections are left out.
   */
  sections(
    context: CommandContext,
    query: string,
    translate: (key: string) => string,
  ): CommandSection[] {
    const needle = query.trim().toLowerCase();
    return this.providers.flatMap((provider) => {
      const commands = provider
        .list(context)
        .filter(
          (command) =>
            needle.length === 0 ||
            command.name.toLowerCase().includes(needle) ||
            commandLabel(command, translate).toLowerCase().includes(needle),
        )
        .map((command, order) => ({ command, order }))
        .sort(
          (a, b) =>
            Number(!a.command.name.toLowerCase().startsWith(needle)) -
              Number(!b.command.name.toLowerCase().startsWith(needle)) || a.order - b.order,
        )
        .map(({ command }) => command);
      return commands.length > 0
        ? [{ id: provider.id, labelKey: provider.labelKey, commands }]
        : [];
    });
  }

  /** A command by id, from any section. */
  get(id: string, context: CommandContext = EMPTY_CONTEXT): ChatCommand | undefined {
    for (const provider of this.providers) {
      const found = provider.list(context).find((command) => command.id === id);
      if (found) return found;
    }
    return undefined;
  }

  /** A command by its `/name` token, with aliases as a fallback. */
  getByName(name: string, context: CommandContext = EMPTY_CONTEXT): ChatCommand | undefined {
    const wanted = name.toLowerCase();
    for (const provider of this.providers) {
      const found = provider
        .list(context)
        .find(
          (command) =>
            command.name === wanted || (command.aliases ?? []).some((alias) => alias === wanted),
        );
      if (found) return found;
    }
    return undefined;
  }

  /** Prompt commands worth suggesting for this context, in registry order. */
  suggest(context: CommandContext, limit: number): PromptCommand[] {
    return this.providers
      .flatMap((provider) => provider.list(context))
      .filter(isPromptCommand)
      .filter((command) => command.when?.(context) ?? true)
      .slice(0, limit);
  }
}
