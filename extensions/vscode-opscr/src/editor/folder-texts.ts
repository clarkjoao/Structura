import type { TextsPort } from "../generated/opscr-engine/engine";
import type { SourceText } from "../generated/opscr-engine/patches";

/** How the folder is read and written; VSCode in the extension, a Map in tests. */
export interface FolderIO {
  /** File names in the folder. */
  list(): Promise<string[]>;
  /** An open document's text (unsaved edits included), else the file on disk. */
  read(name: string): Promise<string | undefined>;
  /** Replaces a document's text as an edit (undoable, left unsaved); creates the file if needed. */
  writeDocument(name: string, text: string): Promise<void>;
  /** Writes straight to disk (the machine-written layout sidecar). */
  writeDisk(name: string, text: string): Promise<void>;
}

/**
 * The engine's texts over a VSCode folder: a synchronous view of every tracked file, kept up to
 * date from document and disk events, and edits written back — manifests as document edits (so
 * VSCode's undo and save apply), the layout sidecar to disk. Writes are serialized, and echoes
 * of the engine's own writes are recognized (same text) so they do not trigger another sync.
 */
export class FolderTexts implements TextsPort {
  private readonly texts = new Map<string, string>();
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly io: FolderIO,
    private readonly tracked: (name: string) => boolean,
    private readonly sidecar: string,
  ) {}

  async load(): Promise<void> {
    this.texts.clear();
    for (const name of (await this.io.list()).filter(this.tracked).sort()) {
      const text = await this.io.read(name);
      if (text !== undefined) this.texts.set(name, text);
    }
    // The sidecar may not exist yet: the first sync writes it.
    if (!this.texts.has(this.sidecar)) this.texts.set(this.sidecar, "");
  }

  get(): SourceText[] {
    return [...this.texts].map(([name, text]) => ({ name, text }));
  }

  set(files: readonly SourceText[]): Promise<void> {
    for (const { name, text } of files) {
      if (this.texts.get(name) === text) continue;
      this.texts.set(name, text);
      const write =
        name === this.sidecar
          ? () => this.io.writeDisk(name, text)
          : () => this.io.writeDocument(name, text);
      this.writing = this.writing.then(write).catch((error: unknown) => {
        console.error(`[opscr] writing ${name} failed:`, error);
      });
    }
    return this.writing;
  }

  /**
   * A change seen in VSCode (a document edit, a file changed or removed on disk). True when it
   * is news — not the echo of the engine's own write.
   */
  update(name: string, text: string | undefined): boolean {
    if (!this.tracked(name)) return false;
    if (text === undefined) {
      if (name === this.sidecar) return false;
      return this.texts.delete(name);
    }
    if (this.texts.get(name) === text) return false;
    this.texts.set(name, text);
    return true;
  }
}
