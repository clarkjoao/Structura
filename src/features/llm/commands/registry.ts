import type { Diagram } from "@/features/diagram";

/** What a command can look at to decide whether it is worth suggesting. */
export interface CommandContext {
  diagram: Diagram | null;
  selectionIds: readonly string[];
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
  labelKey: string;
  descriptionKey: string;
  /** Whether to suggest the command for this context; absent means always. */
  when?: (context: CommandContext) => boolean;
}

/** Sends a turn: the model receives `instruction` (English), the user's text and the context. */
export interface PromptCommand extends CommandBase {
  kind: "prompt";
  instruction: string;
}

/** Does something in the chat instead of sending a turn. */
export interface ActionCommand extends CommandBase {
  kind: "action";
  run: (context: CommandActionContext) => void | Promise<void>;
}

export type ChatCommand = PromptCommand | ActionCommand;

export function isPromptCommand(command: ChatCommand): command is PromptCommand {
  return command.kind === "prompt";
}

export function isActionCommand(command: ChatCommand): command is ActionCommand {
  return command.kind === "action";
}

/**
 * A group of commands in the `/` menu. Phase 5 adds a "Skills" section by
 * registering another provider; nothing else changes.
 */
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
            translate(command.labelKey).toLowerCase().includes(needle),
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

  /** A command by its `/name` token. */
  getByName(name: string, context: CommandContext = EMPTY_CONTEXT): ChatCommand | undefined {
    const wanted = name.toLowerCase();
    for (const provider of this.providers) {
      const found = provider.list(context).find((command) => command.name === wanted);
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
