import { describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import type { Diagram } from "@/features/diagram";
import { fixtureDiagram } from "../test-utils/fixture-host";
import { BUILT_IN_COMMANDS, createCommandRegistry } from "./builtins";
import {
  CommandRegistry,
  isActionCommand,
  isPromptCommand,
  type CommandContext,
  type CommandSectionProvider,
} from "./registry";

const t = (key: string) => i18n.t(key);

function context(diagram: Diagram | null, selectionIds: string[] = []): CommandContext {
  return { diagram, selectionIds };
}

const small = fixtureDiagram({
  a: { id: "a", type: "container", name: "A", description: "", parentId: null },
});

const big = fixtureDiagram(
  Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => [
      `n${index}`,
      {
        id: `n${index}`,
        type: "container" as const,
        name: `N${index}`,
        description: "",
        parentId: null,
      },
    ]),
  ),
);

describe("command registry", () => {
  it("lists the six built-in commands in one Commands section", () => {
    const sections = createCommandRegistry().sections(context(null), "", t);
    expect(sections.map((section) => section.id)).toEqual(["commands"]);
    expect(sections[0]?.commands.map((command) => command.name)).toEqual([
      "review",
      "explain",
      "well-arch",
      "blast-radius",
      "clear",
      "copy",
    ]);
  });

  it("looks commands up by id and name, and tells prompt from action", () => {
    const registry = createCommandRegistry();
    const review = registry.get("review");
    expect(review && isPromptCommand(review) && review.instruction).toMatch(
      /Review the architecture/,
    );
    const clear = registry.getByName("clear");
    expect(clear && isActionCommand(clear)).toBe(true);
    expect(registry.get("missing")).toBeUndefined();
  });

  it("filters by name or translated label, name-prefix matches first", () => {
    const registry = createCommandRegistry();
    const found = registry.sections(context(null), "re", t)[0]?.commands.map((c) => c.name);
    expect(found?.[0]).toBe("review");
    expect(registry.sections(context(null), "zzz", t)).toEqual([]);
  });

  it("suggests prompt commands by their when(ctx)", () => {
    const registry = createCommandRegistry();
    expect(registry.suggest(context(small), 4).map((c) => c.name)).toEqual(["review", "explain"]);
    expect(registry.suggest(context(small, ["a"]), 4).map((c) => c.name)).toEqual([
      "review",
      "explain",
      "blast-radius",
    ]);
    expect(registry.suggest(context(big), 4).map((c) => c.name)).toContain("blast-radius");
    expect(BUILT_IN_COMMANDS.filter(isPromptCommand)).toHaveLength(4);
  });

  it("lets a later phase add a section through a provider", () => {
    const registry = createCommandRegistry();
    const skills: CommandSectionProvider = {
      id: "skills",
      labelKey: "llmChat.command.section.commands",
      list: () => [
        {
          id: "skill-x",
          name: "skill-x",
          labelKey: "x",
          descriptionKey: "x",
          kind: "action",
          run: vi.fn(),
        },
      ],
    };
    registry.registerSection(skills);
    expect(registry.sections(context(null), "", t).map((section) => section.id)).toEqual([
      "commands",
      "skills",
    ]);
    expect(registry.get("skill-x")?.name).toBe("skill-x");
    expect(() => registry.registerSection(skills)).toThrow(/already registered/);
  });

  it("runs action commands against the context the chat provides", async () => {
    const actions = { newConversation: vi.fn(), copyConversation: vi.fn(async () => undefined) };
    const registry = new CommandRegistry();
    registry.registerSection({ id: "commands", labelKey: "k", list: () => BUILT_IN_COMMANDS });
    const copy = registry.getByName("copy");
    if (copy && isActionCommand(copy)) await copy.run(actions);
    expect(actions.copyConversation).toHaveBeenCalledTimes(1);
  });
});
