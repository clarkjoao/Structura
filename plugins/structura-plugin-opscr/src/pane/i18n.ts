/**
 * The pane's own text: plugins cannot add keys to the app's catalogs, so they carry their
 * translations (en, pt-BR) and pick by the locale the host passes in the panel context.
 */
export type Locale = "en" | "pt-BR";

const en = {
  noDiagram: "Open a diagram to bind it to an opscr folder.",
  intro:
    "Bind this diagram to a folder of opscr manifests: edit them here or on the canvas and the other side follows. Elements you move stay where you put them.",
  bind: "Bind to opscr folder…",
  unsupported:
    "This browser cannot open folders. Use a Chromium-based browser, or import a file instead.",
  boundTo: (name: string) => `Bound to the folder “${name}”.`,
  reconnect: "Reconnect folder",
  permissionDenied: "Permission to the folder was not granted.",
  unbind: "Unbind",
  save: "Save",
  reload: "Reload",
  reloadDiscards: "Reloading discards unsaved edits",
  parseError: "The YAML does not parse — the diagram keeps its last state.",
  synced: (n: number) => `Diagram in sync · ${n} elements`,
  saved: (n: number) => (n === 0 ? "Nothing to save" : `Saved ${n} file${n === 1 ? "" : "s"}`),
  problemsElsewhere: (n: number) => `${n} error${n === 1 ? "" : "s"} in other files`,
  renameRefused: (name: string) =>
    name.trim() === ""
      ? "A name cannot be empty — rename reverted"
      : `“${name}” is already taken — rename reverted`,
  notInYaml: (n: number) => `${n} element${n === 1 ? "" : "s"} not in the YAML`,
};

const ptBR: typeof en = {
  noDiagram: "Abra um diagrama para vinculá-lo a uma pasta opscr.",
  intro:
    "Vincule este diagrama a uma pasta de manifestos opscr: edite-os aqui ou no canvas e o outro lado acompanha. Elementos que você mover ficam onde você os colocou.",
  bind: "Vincular a uma pasta opscr…",
  unsupported:
    "Este navegador não abre pastas. Use um navegador baseado em Chromium, ou importe um arquivo.",
  boundTo: (name: string) => `Vinculado à pasta “${name}”.`,
  reconnect: "Reconectar pasta",
  permissionDenied: "A permissão para a pasta não foi concedida.",
  unbind: "Desvincular",
  save: "Salvar",
  reload: "Recarregar",
  reloadDiscards: "Recarregar descarta edições não salvas",
  parseError: "O YAML não faz parse — o diagrama mantém o último estado.",
  synced: (n: number) => `Diagrama sincronizado · ${n} elementos`,
  saved: (n: number) =>
    n === 0 ? "Nada a salvar" : `${n} arquivo${n === 1 ? "" : "s"} salvo${n === 1 ? "" : "s"}`,
  problemsElsewhere: (n: number) => `${n} erro${n === 1 ? "" : "s"} em outros arquivos`,
  renameRefused: (name: string) =>
    name.trim() === ""
      ? "O nome não pode ficar vazio — renomeação desfeita"
      : `“${name}” já está em uso — renomeação desfeita`,
  notInYaml: (n: number) => `${n} elemento${n === 1 ? "" : "s"} fora do YAML`,
};

export const text = (locale: Locale) => (locale === "pt-BR" ? ptBR : en);
