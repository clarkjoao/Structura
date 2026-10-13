import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, GitBranch, LayoutGrid, MousePointer2, Sparkles, Workflow } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { MentionIcon, MentionMatch } from "../../mentions/providers";
import { commandLabel, isSkillCommand, type SkillCommand } from "../../commands/registry";
import { SkillSourceBadge } from "../skills/SkillSourceBadge";
import { skillToolsLabelKey } from "../../skills/skill.types";
import { isCommandMenuItem, type MenuItem, type MenuSection } from "./composer-menu";

const ICONS: Record<MentionIcon, typeof Box> = {
  selection: MousePointer2,
  node: Box,
  edge: GitBranch,
  flow: Workflow,
  diagram: LayoutGrid,
};

function Highlighted({ text, match }: { text: string; match: MentionMatch | null }) {
  if (!match) return <>{text}</>;
  return (
    <>
      {text.slice(0, match.start)}
      <strong className="font-semibold text-foreground">
        {text.slice(match.start, match.end)}
      </strong>
      {text.slice(match.end)}
    </>
  );
}

interface ComposerMenuProps {
  listId: string;
  /** i18n key naming the listbox. */
  labelKey: string;
  sections: readonly MenuSection[];
  activeKey: string;
  onActiveKeyChange: (key: string) => void;
  onChoose: (item: MenuItem) => void;
}

/**
 * The composer's menu for `@` and `/`, on cmdk. Focus stays in the textarea,
 * which drives the active item (`value`) and points at it with
 * `aria-activedescendant`.
 */
export const ComposerMenu = forwardRef<HTMLDivElement, ComposerMenuProps>(function ComposerMenu(
  { listId, labelKey, sections, activeKey, onActiveKeyChange, onChoose },
  ref,
) {
  const { t } = useTranslation();
  const label = t(labelKey);

  return (
    <Command
      shouldFilter={false}
      value={activeKey}
      onValueChange={onActiveKeyChange}
      loop
      className="absolute inset-x-0 bottom-full z-30 mb-2 h-auto rounded-md border border-border shadow-lg"
    >
      <CommandList ref={ref} id={listId} aria-label={label} className="max-h-80">
        {sections.length === 0 ? (
          <CommandPrimitive.Empty className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t("llmChat.menu.empty")}
          </CommandPrimitive.Empty>
        ) : null}
        {sections.map((section) => (
          <CommandGroup
            key={section.id}
            heading={t(section.labelKey)}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {section.items.map((item) => (
              <CommandItem
                key={item.key}
                value={item.key}
                onSelect={() => onChoose(item)}
                className="gap-2.5 text-[13px]"
              >
                {isCommandMenuItem(item) && isSkillCommand(item.command) ? (
                  <SkillRow command={item.command} match={item.match} />
                ) : isCommandMenuItem(item) ? (
                  <>
                    <code className="min-w-24 font-mono text-xs font-medium">
                      <Highlighted text={`/${item.command.name}`} match={item.match} />
                    </code>
                    <span className="truncate">{commandLabel(item.command, t)}</span>
                  </>
                ) : (
                  <MentionRow item={item.option} />
                )}
              </CommandItem>
            ))}
            {section.total > section.items.length ? (
              <p className="px-2 pb-1 text-[11px] text-muted-foreground">
                {t("llmChat.mention.more", { count: section.total - section.items.length })}
              </p>
            ) : null}
          </CommandGroup>
        ))}
      </CommandList>
      <div
        aria-hidden
        className="flex gap-3.5 border-t border-border bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground"
      >
        <span>{t("llmChat.menu.hintNavigate")}</span>
        <span>{t("llmChat.menu.hintChoose")}</span>
        <span>{t("llmChat.menu.hintComplete")}</span>
        <span>{t("llmChat.menu.hintClose")}</span>
      </div>
    </Command>
  );
});

function MentionRow({ item }: { item: Extract<MenuItem, { type: "mention" }>["option"] }) {
  const Icon = ICONS[item.icon];
  return (
    <>
      <span
        className={cn(
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded bg-muted text-muted-foreground",
        )}
      >
        <Icon aria-hidden className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 truncate">
        <Highlighted text={item.label} match={item.match} />
      </span>
      <span className="ml-auto shrink-0 truncate pl-2 text-xs text-muted-foreground">
        {item.secondary}
      </span>
    </>
  );
}

function SkillRow({ command, match }: { command: SkillCommand; match: MentionMatch | null }) {
  const { t } = useTranslation();
  const { skill } = command;
  const tools = skill.tools?.length ?? 0;
  return (
    <>
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
        <Sparkles aria-hidden className="h-3.5 w-3.5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate">
          <Highlighted text={skill.name} match={match} />
        </span>
        <span className="truncate text-xs text-muted-foreground">{skill.description}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 text-xs text-muted-foreground">
        <span>{t(skillToolsLabelKey(skill), { count: tools })}</span>
        <SkillSourceBadge source={skill.source} />
      </span>
    </>
  );
}
