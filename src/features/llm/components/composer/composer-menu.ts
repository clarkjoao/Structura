import type { ChatCommand, CommandContext, CommandRegistry } from "../../commands/registry";
import type { MentionMatch, MentionOption, MentionProviderRegistry, MentionSearchData } from "../../mentions/providers";

/**
 * The composer's one menu: `@` lists context (mention providers), `/` at the
 * start of the message lists commands. Pure functions; the component renders.
 */

export type MenuMode = "mention" | "command";

/** Where the trigger sits in the text, and what was typed after it. */
export interface MenuTrigger {
  mode: MenuMode;
  query: string;
  /** Range of `@query` / `/query` in the text, removed when an item is chosen. */
  start: number;
  end: number;
}

const MENTION_TRIGGER = /(?:^|\s)@([^\s@]*)$/;
const COMMAND_TRIGGER = /^(\s*)\/(\S*)$/;

/**
 * The trigger at the caret, if any. `/` only counts at the start of the
 * message and while no command chip is set.
 */
export function findTrigger(
  text: string,
  caret: number,
  allowCommand: boolean,
): MenuTrigger | null {
  const before = text.slice(0, caret);
  const command = allowCommand ? before.match(COMMAND_TRIGGER) : null;
  if (command) {
    const query = command[2] ?? "";
    const start = (command[1] ?? "").length;
    return { mode: "command", query, start, end: caret };
  }
  const mention = before.match(MENTION_TRIGGER);
  if (mention) {
    const query = mention[1] ?? "";
    return { mode: "mention", query, start: caret - query.length - 1, end: caret };
  }
  return null;
}

export function isMentionTrigger(trigger: MenuTrigger): boolean {
  return trigger.mode === "mention";
}

/** Removes the trigger text (`@query`, `/query`) from the draft. */
export function removeTrigger(text: string, trigger: MenuTrigger): string {
  return (text.slice(0, trigger.start) + text.slice(trigger.end)).replace(/^\s+$/, "");
}

export interface MentionMenuItem {
  key: string;
  type: "mention";
  option: MentionOption;
}

export interface CommandMenuItem {
  key: string;
  type: "command";
  command: ChatCommand;
  match: MentionMatch | null;
}

export type MenuItem = MentionMenuItem | CommandMenuItem;

export function isMentionMenuItem(item: MenuItem): item is MentionMenuItem {
  return item.type === "mention";
}

export function isCommandMenuItem(item: MenuItem): item is CommandMenuItem {
  return item.type === "command";
}

export interface MenuSection {
  id: string;
  labelKey: string;
  items: MenuItem[];
  /** Items before the cap; more than `items.length` means "+N more". */
  total: number;
}

function commandMatch(name: string, query: string): MentionMatch | null {
  if (!query) return null;
  const start = name.toLowerCase().indexOf(query.toLowerCase());
  return start === -1 ? null : { start: start + 1, end: start + 1 + query.length };
}

export function buildMenuSections(
  trigger: MenuTrigger,
  mentionRegistry: MentionProviderRegistry,
  mentionData: MentionSearchData,
  commandRegistry: CommandRegistry,
  commandContext: CommandContext,
): MenuSection[] {
  if (isMentionTrigger(trigger)) {
    return mentionRegistry.search(trigger.query, mentionData).map((section) => ({
      id: section.providerId,
      labelKey: section.labelKey,
      total: section.total,
      items: section.items.map((option) => ({ key: option.key, type: "mention", option })),
    }));
  }
  return commandRegistry
    .sections(commandContext, trigger.query, mentionData.translate)
    .map((section) => ({
      id: section.id,
      labelKey: section.labelKey,
      total: section.commands.length,
      items: section.commands.map((command) => ({
        key: `command:${command.id}`,
        type: "command",
        command,
        // The rendered label is "/name": the match range counts the slash.
        match: commandMatch(command.name, trigger.query),
      })),
    }));
}

export function flattenItems(sections: readonly MenuSection[]): MenuItem[] {
  return sections.flatMap((section) => section.items);
}
