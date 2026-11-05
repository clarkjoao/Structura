import { compileSources } from "opscr/core";
import { CONFIG_FILE, isManifest } from "./project";
import { emptyBinding } from "./engine/sync";
import { emptyViewDiagrams } from "./engine/view-diagrams";
import { handOff } from "./pane/handoff";
import { bindingStorageKey, type StoredBinding } from "./pane/OpscrPane";
import { viewDiagramsStorageKey, type StoredViewDiagrams } from "./pane/useViewDiagrams";
import type {
  StructuraPluginApi,
  WorkspaceImporterContribution,
  WorkspaceImportResult,
} from "./types/plugin.types";

export const PANE_ID = "structura-plugin-opscr/pane";
/** Where the picked folder waits until the diagram it binds exists. */
const PENDING = "workspace-import";
/** The diagrams workspace imports made, to open one again instead of making it twice. */
const IMPORTS_KEY = "workspace-imports";

const TEXT = {
  en: {
    unsupported: "This browser cannot open folders. Use a Chromium-based browser.",
    noManifests: (name: string) => `“${name}” has no opscr manifests (*.opscr.yaml) at its top.`,
  },
  "pt-BR": {
    unsupported: "Este navegador não abre pastas. Use um navegador baseado em Chromium.",
    noManifests: (name: string) =>
      `“${name}” não tem manifestos opscr (*.opscr.yaml) no primeiro nível.`,
  },
};

/** What a folder's root says about itself: the product's name and description, and its Views. */
async function describe(texts: Array<{ path: string; content: string }>, folderName: string) {
  const files = texts.filter((f) => isManifest(f.path));
  const config = texts.find((f) => f.path === CONFIG_FILE);
  const { workspace } = await compileSources(config ? { files, config } : { files });
  const product = workspace.getByKind("Product")[0];
  const displayName = product?.spec["displayName"];
  const description = product?.spec["description"];
  return {
    title:
      typeof displayName === "string" && displayName.trim()
        ? displayName.trim()
        : (product?.metadata.name ?? folderName),
    description: typeof description === "string" ? description : undefined,
    views: workspace.getByKind("View").length,
  };
}

/**
 * "opscr folder (product)" on the workspace home (plugin API 1.14): one pick sets the whole
 * folder up — a workspace folder named after the product, its main diagram bound to the folder,
 * a diagram for each View switched on, and the pane opened beside it, where the folder opens
 * without asking again and draws the root, the View diagrams and the initiatives' Versions. A
 * folder imported before opens its diagram again.
 */
export function createWorkspaceImport(api: StructuraPluginApi): WorkspaceImporterContribution {
  return {
    id: "structura-plugin-opscr/folder",
    label: { en: "opscr folder (product)", "pt-BR": "Pasta opscr (produto)" },
    description: {
      en: "A diagram bound to the folder, one per View, and its initiatives as Versions",
      "pt-BR": "Um diagrama vinculado à pasta, um por view, e as iniciativas como Versões",
    },
    async run({ locale, folderId }): Promise<WorkspaceImportResult | null> {
      const t = TEXT[locale === "pt-BR" ? "pt-BR" : "en"];
      if (!api.files.isSupported()) throw new Error(t.unsupported);
      const folder = await api.files.pick(PENDING);
      if (!folder) return null;

      const imported = (await api.storage.get<string[]>(IMPORTS_KEY)) ?? [];
      const alive = imported.filter((id) => api.getDiagram(id) !== null);
      for (const id of alive) {
        if (await api.files.isSame(PENDING, id)) {
          await api.files.move(PENDING, id);
          handOff(id, folder);
          return { diagramId: id, openPane: PANE_ID };
        }
      }

      const names = await folder.list();
      const wanted = names.filter((n) => isManifest(n) || n === CONFIG_FILE);
      if (!wanted.some(isManifest)) {
        await api.files.forget(PENDING);
        throw new Error(t.noManifests(folder.name));
      }
      const texts = await Promise.all(
        wanted.map(async (path) => ({ path, content: await folder.read(path) })),
      );
      const about = await describe(texts, folder.name);

      const workspaceFolder = api.createFolder({ name: about.title, parentId: folderId });
      const diagramId = api.createDiagram({
        name: about.title,
        ...(about.description ? { description: about.description } : {}),
        folderId: workspaceFolder,
      });
      await api.files.move(PENDING, diagramId);
      const binding: StoredBinding = { folderName: folder.name, state: emptyBinding() };
      await api.storage.set(bindingStorageKey(diagramId), binding);
      if (about.views > 0) {
        const views: StoredViewDiagrams = { enabled: true, state: emptyViewDiagrams() };
        await api.storage.set(viewDiagramsStorageKey(diagramId), views);
      }
      await api.storage.set(IMPORTS_KEY, [...alive, diagramId]);
      handOff(diagramId, folder);
      return { diagramId, openPane: PANE_ID };
    },
  };
}
