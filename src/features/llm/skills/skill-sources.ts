import type { IStoragePort } from "@/infrastructure/persistence";
import { skillFileStem } from "./skill-format";
import type { SkillSource } from "./skill.types";
import { BUILTIN_SKILL_FILES, createBuiltinSkillSource } from "./builtin-skills";

/**
 * Where skills live. Each source stores skill files as text (the skill file
 * format) plus the user's enabled flag; parsing happens in the store, so a
 * broken file is still listed and can be fixed.
 */

/** One skill file as a source holds it. */
export interface SkillFile {
  id: string;
  text: string;
  enabled: boolean;
  /** Workspace files only: the path inside the workspace folder. */
  path?: string;
  /** The file is there but could not be read. */
  readError?: string;
}

export interface SkillSourceAdapter {
  readonly source: SkillSource;
  /** Lists skills but takes no new or changed ones (built-in skills). */
  readonly readOnly?: boolean;
  list(): Promise<SkillFile[]>;
  read(id: string): Promise<SkillFile | null>;
  /** Stores a new skill; `nameHint` names the file where the source has files. */
  create(text: string, nameHint: string): Promise<SkillFile>;
  update(id: string, text: string): Promise<void>;
  delete(id: string): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  /** Calls `onChange` when the files change outside the app; returns an unsubscribe. */
  watch?(onChange: () => void): () => void;
}

/**
 * How the workspace folder reaches the chat, injected by the app (like the
 * diagram tool host) so the llm feature does not depend on the folder sync.
 * Paths are folder segments under the workspace root. Write methods throw on
 * failure; the message is shown to the user.
 */
export interface SkillFolderHost {
  isConnected(): boolean;
  /** Identifies the connected workspace, for per-user state; null when none. */
  workspaceId(): string | null;
  listFiles(segments: readonly string[]): Promise<string[]>;
  readFile(segments: readonly string[], fileName: string): Promise<string>;
  writeFile(segments: readonly string[], fileName: string, text: string): Promise<void>;
  deleteFile(segments: readonly string[], fileName: string): Promise<void>;
  watch?(segments: readonly string[], onChange: () => void): () => void;
}

/** Where workspace skills live, relative to the workspace folder. */
export const WORKSPACE_SKILLS_DIR: readonly string[] = [".structura", "skills"];
const SKILL_EXTENSION = ".md";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// ─── Workspace ────────────────────────────────────────────────────────────────

/**
 * Skills as `.structura/skills/*.md` in the connected workspace. The file is
 * the shared definition; enabling a skill is personal, so the enabled flags
 * are kept per user in `port`, keyed by workspace and path.
 */
export function createWorkspaceSkillSource(
  host: SkillFolderHost,
  port: IStoragePort,
): SkillSourceAdapter {
  const dirPath = WORKSPACE_SKILLS_DIR.join("/");
  const pathOf = (fileName: string) => `${dirPath}/${fileName}`;
  const fileNameOf = (id: string) => {
    const prefix = `${dirPath}/`;
    if (!id.startsWith(prefix)) throw new Error(`Not a workspace skill path: ${id}`);
    return id.slice(prefix.length);
  };
  const enabledKey = () => `llm-skills:workspace-enabled:${host.workspaceId() ?? ""}`;

  async function readEnabled(): Promise<Record<string, boolean>> {
    const stored = await port.load<unknown>(enabledKey());
    if (!isRecord(stored)) return {};
    const flags: Record<string, boolean> = {};
    for (const [path, value] of Object.entries(stored)) {
      if (typeof value === "boolean") flags[path] = value;
    }
    return flags;
  }

  async function writeEnabled(path: string, enabled: boolean | null): Promise<void> {
    const flags = await readEnabled();
    if (enabled === null) {
      delete flags[path];
    } else {
      flags[path] = enabled;
    }
    await port.save(enabledKey(), flags);
  }

  async function readFile(fileName: string, flags: Record<string, boolean>): Promise<SkillFile> {
    const path = pathOf(fileName);
    const enabled = flags[path] ?? true;
    try {
      const text = await host.readFile(WORKSPACE_SKILLS_DIR, fileName);
      return { id: path, path, text, enabled };
    } catch (error) {
      return { id: path, path, text: "", enabled, readError: errorMessage(error) };
    }
  }

  const source: SkillSourceAdapter = {
    source: "workspace",

    async list() {
      const names = (await host.listFiles(WORKSPACE_SKILLS_DIR)).filter((name) =>
        name.toLowerCase().endsWith(SKILL_EXTENSION),
      );
      const flags = await readEnabled();
      return Promise.all(names.map((name) => readFile(name, flags)));
    },

    async read(id) {
      const fileName = fileNameOf(id);
      const names = await host.listFiles(WORKSPACE_SKILLS_DIR);
      if (!names.includes(fileName)) return null;
      return readFile(fileName, await readEnabled());
    },

    async create(text, nameHint) {
      const taken = new Set(
        (await host.listFiles(WORKSPACE_SKILLS_DIR)).map((name) => name.toLowerCase()),
      );
      const stem = skillFileStem(nameHint);
      let fileName = `${stem}${SKILL_EXTENSION}`;
      for (let n = 2; taken.has(fileName.toLowerCase()); n += 1) {
        fileName = `${stem}-${n}${SKILL_EXTENSION}`;
      }
      await host.writeFile(WORKSPACE_SKILLS_DIR, fileName, text);
      const path = pathOf(fileName);
      return { id: path, path, text, enabled: true };
    },

    async update(id, text) {
      await host.writeFile(WORKSPACE_SKILLS_DIR, fileNameOf(id), text);
    },

    async delete(id) {
      await host.deleteFile(WORKSPACE_SKILLS_DIR, fileNameOf(id));
      await writeEnabled(id, null);
    },

    async setEnabled(id, enabled) {
      await writeEnabled(id, enabled);
    },
  };

  const watch = host.watch;
  if (watch) {
    source.watch = (onChange) => watch(WORKSPACE_SKILLS_DIR, onChange);
  }
  return source;
}

// ─── Local ────────────────────────────────────────────────────────────────────

const LOCAL_INDEX_KEY = "llm-skills:local:__ids";
const localKey = (id: string) => `llm-skills:local:${id}`;

interface StoredLocalSkill {
  text: string;
  enabled: boolean;
}

function isStoredLocalSkill(value: unknown): value is StoredLocalSkill {
  return isRecord(value) && typeof value.text === "string" && typeof value.enabled === "boolean";
}

/**
 * Skills kept in the browser, for users without a connected folder. Stored
 * as one key per skill plus an id index, like plugin storage, so the set is
 * enumerable without listing the port.
 */
export function createLocalSkillSource(port: IStoragePort): SkillSourceAdapter {
  async function readIndex(): Promise<string[]> {
    const ids = await port.load<unknown>(LOCAL_INDEX_KEY);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  }

  async function readOne(id: string): Promise<SkillFile | null> {
    const stored = await port.load<unknown>(localKey(id));
    return isStoredLocalSkill(stored) ? { id, text: stored.text, enabled: stored.enabled } : null;
  }

  async function write(id: string, value: StoredLocalSkill): Promise<void> {
    await port.save(localKey(id), value);
  }

  return {
    source: "local",

    async list() {
      const files = await Promise.all((await readIndex()).map(readOne));
      return files.filter((file): file is SkillFile => file !== null);
    },

    read: readOne,

    async create(text) {
      const id = crypto.randomUUID();
      await write(id, { text, enabled: true });
      await port.save(LOCAL_INDEX_KEY, [...(await readIndex()), id]);
      return { id, text, enabled: true };
    },

    async update(id, text) {
      const current = await readOne(id);
      if (!current) throw new Error(`Local skill not found: ${id}`);
      await write(id, { text, enabled: current.enabled });
    },

    async delete(id) {
      await port.delete(localKey(id));
      await port.save(
        LOCAL_INDEX_KEY,
        (await readIndex()).filter((candidate) => candidate !== id),
      );
    },

    async setEnabled(id, enabled) {
      const current = await readOne(id);
      if (!current) throw new Error(`Local skill not found: ${id}`);
      await write(id, { text: current.text, enabled });
    },
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/** The sources that are available right now, by kind. */
export class SkillSourceRegistry {
  private readonly sources = new Map<SkillSource, SkillSourceAdapter>();

  register(source: SkillSourceAdapter): void {
    if (this.sources.has(source.source)) {
      throw new Error(`A skill source "${source.source}" is already registered`);
    }
    this.sources.set(source.source, source);
  }

  get(source: SkillSource): SkillSourceAdapter | undefined {
    return this.sources.get(source);
  }

  has(source: SkillSource): boolean {
    return this.sources.has(source);
  }

  list(): SkillSourceAdapter[] {
    return [...this.sources.values()];
  }
}

/**
 * Local and Built-in are always there; Workspace only while a folder is
 * connected, so the question "where do I save this?" is answered by what is
 * registered (and not read-only).
 */
export function createSkillSourceRegistry(
  port: IStoragePort,
  host: SkillFolderHost | null,
  builtinFiles: Readonly<Record<string, string>> = BUILTIN_SKILL_FILES,
): SkillSourceRegistry {
  const registry = new SkillSourceRegistry();
  if (host?.isConnected() && host.workspaceId()) {
    registry.register(createWorkspaceSkillSource(host, port));
  }
  registry.register(createLocalSkillSource(port));
  if (Object.keys(builtinFiles).length > 0) {
    registry.register(createBuiltinSkillSource(port, builtinFiles));
  }
  return registry;
}
