import type { IStoragePort } from "@/infrastructure/persistence";
import awsArchitecture from "./builtin/aws-architecture.md?raw";
import type { SkillFile, SkillSourceAdapter } from "./skill-sources";

/** The skills that ship with the app, by id (their file name). */
export const BUILTIN_SKILL_FILES: Readonly<Record<string, string>> = {
  "aws-architecture.md": awsArchitecture,
};

const ENABLED_KEY = "llm-skills:builtin-enabled";

function readOnly(): never {
  throw new Error("Built-in skills cannot be changed. Export one to make your own copy.");
}

/**
 * The built-in skills: bundled with the app, read-only. Only the user's
 * enabled flag is stored, in `port`; every built-in skill starts enabled.
 */
export function createBuiltinSkillSource(
  port: IStoragePort,
  files: Readonly<Record<string, string>> = BUILTIN_SKILL_FILES,
): SkillSourceAdapter {
  async function readEnabled(): Promise<Record<string, boolean>> {
    const stored = await port.load<unknown>(ENABLED_KEY);
    if (typeof stored !== "object" || stored === null) return {};
    return Object.fromEntries(
      Object.entries(stored).filter((entry): entry is [string, boolean] => {
        return typeof entry[1] === "boolean";
      }),
    );
  }

  const toFile = (id: string, flags: Record<string, boolean>): SkillFile | null => {
    const text = files[id];
    return text === undefined ? null : { id, text, enabled: flags[id] ?? true };
  };

  return {
    source: "builtin",
    readOnly: true,

    async list() {
      const flags = await readEnabled();
      return Object.keys(files).flatMap((id) => toFile(id, flags) ?? []);
    },

    async read(id) {
      return toFile(id, await readEnabled());
    },

    create: async () => readOnly(),
    update: async () => readOnly(),
    delete: async () => readOnly(),

    async setEnabled(id, enabled) {
      if (files[id] === undefined) throw new Error(`Built-in skill not found: ${id}`);
      await port.save(ENABLED_KEY, { ...(await readEnabled()), [id]: enabled });
    },
  };
}
