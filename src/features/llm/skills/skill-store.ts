import { create } from "zustand";
import { defaultStorage, type IStoragePort } from "@/infrastructure/persistence";
import {
  isSkillParseFailure,
  parseSkillMarkdown,
  serializeSkillMarkdown,
  type SkillParseError,
  type SkillParseWarning,
} from "./skill-format";
import { BUILTIN_SKILL_FILES } from "./builtin-skills";
import {
  createSkillSourceRegistry,
  type SkillFile,
  type SkillFolderHost,
  type SkillSourceRegistry,
} from "./skill-sources";
import {
  skillKey,
  type Skill,
  type SkillFields,
  type SkillRef,
  type SkillSource,
} from "./skill.types";

/** A file that is not a usable skill, kept so settings can show why. */
export interface SkillProblem {
  key: string;
  source: SkillSource;
  id: string;
  path?: string;
  /** The raw text, for fixing it. */
  text: string;
  /** Null when the file could not be read at all (see `readError`). */
  error: SkillParseError | null;
  readError?: string;
}

export type SkillWriteResult =
  { ok: true; skill: Skill | null } | { ok: false; parseError?: SkillParseError; message?: string };

export interface SkillImportResult {
  fileName: string;
  result: SkillWriteResult;
}

export interface SkillStoreState {
  /** Every skill that parsed, from every available source, in source order. */
  skills: Skill[];
  problems: SkillProblem[];
  /** Parse warnings (unknown keys), by `skillKey`. */
  warnings: Record<string, SkillParseWarning[]>;
  /** The sources skills can be saved to right now. */
  availableSources: SkillSource[];
  loaded: boolean;

  /** Set by the app shell: how workspace files are reached, or null. */
  setFolderHost: (host: SkillFolderHost | null) => void;
  /** Re-reads every source. Never throws; problems are kept per file. */
  load: () => Promise<void>;
  setEnabled: (skill: Pick<Skill, "source" | "id">, enabled: boolean) => Promise<void>;
  createSkill: (source: SkillSource, fields: SkillFields) => Promise<SkillWriteResult>;
  updateSkill: (
    target: Pick<Skill, "source" | "id">,
    fields: SkillFields,
  ) => Promise<SkillWriteResult>;
  /** Saves raw text as is, e.g. to fix a file that does not parse. */
  saveRawText: (target: Pick<Skill, "source" | "id">, text: string) => Promise<SkillWriteResult>;
  deleteSkill: (target: Pick<Skill, "source" | "id">) => Promise<SkillWriteResult>;
  importFiles: (
    files: ReadonlyArray<{ name: string; text: string }>,
    source: SkillSource,
  ) => Promise<SkillImportResult[]>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface LoadedFile {
  skill: Skill | null;
  problem: SkillProblem | null;
  warnings: SkillParseWarning[];
}

function toLoaded(source: SkillSource, file: SkillFile): LoadedFile {
  const key = skillKey({ source, id: file.id });
  const base = {
    key,
    source,
    id: file.id,
    text: file.text,
    ...(file.path ? { path: file.path } : {}),
  };
  if (file.readError !== undefined) {
    return {
      skill: null,
      problem: { ...base, error: null, readError: file.readError },
      warnings: [],
    };
  }
  const parsed = parseSkillMarkdown(file.text);
  if (isSkillParseFailure(parsed)) {
    return { skill: null, problem: { ...base, error: parsed.error }, warnings: [] };
  }
  return {
    skill: {
      id: file.id,
      source,
      ...parsed.fields,
      enabled: file.enabled,
      ...(file.path ? { path: file.path } : {}),
    },
    problem: null,
    warnings: parsed.warnings,
  };
}

/** Builds the skill store over a storage port; the app uses {@link useSkillStore}. */
export function createSkillStore(
  port: IStoragePort,
  builtinFiles: Readonly<Record<string, string>> = BUILTIN_SKILL_FILES,
) {
  return create<SkillStoreState>((set, get) => {
    let host: SkillFolderHost | null = null;
    let generation = 0;
    let unwatch: Array<() => void> = [];

    const registry = (): SkillSourceRegistry => createSkillSourceRegistry(port, host, builtinFiles);

    const write = async (
      source: SkillSource,
      run: (registry: SkillSourceRegistry) => Promise<Skill | null | void>,
    ): Promise<SkillWriteResult> => {
      const sources = registry();
      if (!sources.has(source)) {
        return { ok: false, message: `Skill source unavailable: ${source}` };
      }
      try {
        const skill = (await run(sources)) ?? null;
        await get().load();
        return { ok: true, skill };
      } catch (error) {
        console.error("[skills] write failed", error);
        return { ok: false, message: errorMessage(error) };
      }
    };

    /** Validates the fields by reading back the text they serialize to. */
    const toText = (fields: SkillFields): { text: string } | { error: SkillParseError } => {
      const text = serializeSkillMarkdown(fields);
      const parsed = parseSkillMarkdown(text);
      return isSkillParseFailure(parsed) ? { error: parsed.error } : { text };
    };

    return {
      skills: [],
      problems: [],
      warnings: {},
      availableSources: ["local"],
      loaded: false,

      setFolderHost: (next) => {
        host = next;
        void get().load();
      },

      load: async () => {
        const current = ++generation;
        const sources = registry();
        const results = await Promise.all(
          sources.list().map(async (source) => {
            try {
              return (await source.list()).map((file) => toLoaded(source.source, file));
            } catch (error) {
              console.error(`[skills] could not list the ${source.source} skills`, error);
              return [];
            }
          }),
        );
        // A newer load started while this one read; it wins.
        if (current !== generation) return;

        for (const stop of unwatch) stop();
        unwatch = sources
          .list()
          .flatMap((source) => (source.watch ? [source.watch(() => void get().load())] : []));

        const loaded = results.flat();
        set({
          skills: loaded.flatMap((entry) => (entry.skill ? [entry.skill] : [])),
          problems: loaded.flatMap((entry) => (entry.problem ? [entry.problem] : [])),
          warnings: Object.fromEntries(
            loaded.flatMap((entry) =>
              entry.skill && entry.warnings.length > 0
                ? [[skillKey(entry.skill), entry.warnings]]
                : [],
            ),
          ),
          availableSources: sources
            .list()
            .filter((source) => !source.readOnly)
            .map((source) => source.source),
          loaded: true,
        });
      },

      setEnabled: async (target, enabled) => {
        const key = skillKey(target);
        set((state) => ({
          skills: state.skills.map((skill) =>
            skillKey(skill) === key ? { ...skill, enabled } : skill,
          ),
        }));
        try {
          await registry().get(target.source)?.setEnabled(target.id, enabled);
        } catch (error) {
          console.error("[skills] could not save the enabled state", error);
          await get().load();
        }
      },

      createSkill: async (source, fields) => {
        const checked = toText(fields);
        if ("error" in checked) return { ok: false, parseError: checked.error };
        return write(source, async (sources) => {
          const created = await sources.get(source)?.create(checked.text, fields.name);
          return created ? toLoaded(source, created).skill : null;
        });
      },

      updateSkill: async (target, fields) => {
        const checked = toText(fields);
        if ("error" in checked) return { ok: false, parseError: checked.error };
        return write(target.source, async (sources) => {
          await sources.get(target.source)?.update(target.id, checked.text);
          return null;
        });
      },

      saveRawText: async (target, text) =>
        write(target.source, async (sources) => {
          await sources.get(target.source)?.update(target.id, text);
          return null;
        }),

      deleteSkill: async (target) =>
        write(target.source, async (sources) => {
          await sources.get(target.source)?.delete(target.id);
          return null;
        }),

      importFiles: async (files, source) => {
        const results: SkillImportResult[] = [];
        for (const file of files) {
          const parsed = parseSkillMarkdown(file.text);
          if (isSkillParseFailure(parsed)) {
            results.push({ fileName: file.name, result: { ok: false, parseError: parsed.error } });
            continue;
          }
          results.push({
            fileName: file.name,
            result: await get().createSkill(source, parsed.fields),
          });
        }
        return results;
      },
    };
  });
}

/** The app's skills, over the default storage port. */
export const useSkillStore = createSkillStore(defaultStorage);

/** A stored ref's skill, if it still exists. */
export function findSkill(skills: readonly Skill[], ref: SkillRef): Skill | undefined {
  const key = skillKey(ref);
  return skills.find((skill) => skillKey(skill) === key);
}

export function selectEnabledSkills(state: Pick<SkillStoreState, "skills">): Skill[] {
  return state.skills.filter((skill) => skill.enabled);
}
