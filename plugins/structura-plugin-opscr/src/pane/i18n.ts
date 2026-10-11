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
  renameGone: "The text changed under the cursor — try the rename again",
  providerRefused: (names: string[]) =>
    `${names.join(", ")}: that service or technology is not a provider of its Kind — reverted`,
  outsideTitle: (n: number) => `${n} element${n === 1 ? "" : "s"} on the canvas not in the YAML`,
  kindFor: (name: string) => `Kind for ${name}`,
  providerFor: (name: string) => `Provider for ${name}`,
  pickKind: "Kind…",
  noProvider: "No provider",
  addToYaml: "Add to YAML",
  addAllToYaml: "Add all to YAML",
  addedToYaml: (keys: string[]) => `Added to the YAML: ${keys.join(", ")}`,
  diskReloaded: (files: string[]) => `Updated from the folder: ${files.join(", ")}`,
  diskConflict: (files: string[]) =>
    `Changed in the folder while you had unsaved edits: ${files.join(", ")}`,
  conflictBanner: (file: string) => `${file} changed in the folder. Your edits are not saved.`,
  useDisk: "Use the folder's version",
  keepMine: "Keep mine",
  compare: "Compare",
  closeCompare: "Close comparison",
  compareHint:
    "The folder's version (red) against yours (green). Edit yours here, then pick a side.",
  emptyFolder: "This folder has no opscr manifests yet.",
  createFirst: "Create a first manifest",
  notCarriedTitle: (n: number) =>
    `${n} thing${n === 1 ? "" : "s"} not carried between the YAML and the diagram`,
  onCanvasOnly: "On the canvas, not in the YAML",
  inYamlOnly: "In the YAML, not on the canvas",
  unwritten: (
    reason: "end-outside" | "not-a-type" | "not-written",
    label: string,
    type?: string,
  ) =>
    reason === "end-outside"
      ? `${label ? `“${label}”` : "A connection"}: an end is not in the YAML yet — written once it is`
      : reason === "not-a-type"
        ? `“${label}” is not an opscr edge type — the YAML says ${type}`
        : `“${label}” could not be written to a Relationship`,
  omitted: (kind: string, name: string) => `${kind} ${name}: this view does not draw ${kind}`,
  dropped: (
    type: string,
    from: string,
    to: string,
    reason: "not-drawn" | "missing" | "second-parent" | "cycle",
  ) =>
    `${from} ${type} ${to}: ` +
    {
      "not-drawn": "an end is not drawn in this view",
      missing: "an end is not declared",
      "second-parent": "a second belongsTo — the first one places it",
      cycle: "it would put an element inside itself",
    }[reason],
  chatTitle: (folder: string) => (folder ? `opscr · ${folder}` : "opscr"),
  chatSubtitle: "Ask for changes to the manifests; the diagram follows.",
  chatSuggestions: [
    "Add a Redis cache in front of the busiest database",
    "Publish an event when an order changes status, for other areas to consume",
    "Review the relationships against the opscr topology and EDA rules",
    "Which elements have no owner or description?",
  ],
  chatClosed: "The opscr pane closed the folder before the reply arrived; nothing was changed.",
  chatChanged: (added: string[], replaced: string[], deleted: string[]) =>
    [
      added.length ? `Added ${added.join(", ")}.` : "",
      replaced.length ? `Updated ${replaced.join(", ")}.` : "",
      deleted.length ? `Removed ${deleted.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  chatUnsaved: "Unsaved — keep or discard it on the canvas, and save in the opscr pane.",
  chatRemainingErrors: "opscr still reports these errors:",
  chatDiscardEdited:
    "The manifests changed after this reply, so it was kept — undo it in the text or on the canvas.",
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
  renameGone: "O texto mudou sob o cursor — tente renomear de novo",
  providerRefused: (names: string[]) =>
    `${names.join(", ")}: esse serviço ou tecnologia não é um provider do seu Kind — desfeito`,
  outsideTitle: (n: number) => `${n} elemento${n === 1 ? "" : "s"} no canvas fora do YAML`,
  kindFor: (name: string) => `Kind de ${name}`,
  providerFor: (name: string) => `Provider de ${name}`,
  pickKind: "Kind…",
  noProvider: "Sem provider",
  addToYaml: "Adicionar ao YAML",
  addAllToYaml: "Adicionar todos ao YAML",
  addedToYaml: (keys: string[]) => `Adicionado ao YAML: ${keys.join(", ")}`,
  diskReloaded: (files: string[]) => `Atualizado a partir da pasta: ${files.join(", ")}`,
  diskConflict: (files: string[]) =>
    `Mudou na pasta enquanto você tinha edições não salvas: ${files.join(", ")}`,
  conflictBanner: (file: string) => `${file} mudou na pasta. Suas edições não estão salvas.`,
  useDisk: "Usar a versão da pasta",
  keepMine: "Manter a minha",
  compare: "Comparar",
  closeCompare: "Fechar comparação",
  compareHint:
    "A versão da pasta (vermelho) contra a sua (verde). Edite a sua aqui e depois escolha um lado.",
  emptyFolder: "Esta pasta ainda não tem manifestos opscr.",
  createFirst: "Criar um primeiro manifesto",
  notCarriedTitle: (n: number) =>
    `${n} ${n === 1 ? "item não levado" : "itens não levados"} entre o YAML e o diagrama`,
  onCanvasOnly: "No canvas, fora do YAML",
  inYamlOnly: "No YAML, fora do canvas",
  unwritten: (
    reason: "end-outside" | "not-a-type" | "not-written",
    label: string,
    type?: string,
  ) =>
    reason === "end-outside"
      ? `${label ? `“${label}”` : "Uma conexão"}: uma ponta ainda não está no YAML — entra quando estiver`
      : reason === "not-a-type"
        ? `“${label}” não é um tipo de aresta do opscr — o YAML diz ${type}`
        : `“${label}” não pôde ser escrita num Relationship`,
  omitted: (kind: string, name: string) => `${kind} ${name}: esta visão não desenha ${kind}`,
  dropped: (
    type: string,
    from: string,
    to: string,
    reason: "not-drawn" | "missing" | "second-parent" | "cycle",
  ) =>
    `${from} ${type} ${to}: ` +
    {
      "not-drawn": "uma ponta não é desenhada nesta visão",
      missing: "uma ponta não está declarada",
      "second-parent": "um segundo belongsTo — o primeiro é que o posiciona",
      cycle: "colocaria um elemento dentro de si mesmo",
    }[reason],
  chatTitle: (folder: string) => (folder ? `opscr · ${folder}` : "opscr"),
  chatSubtitle: "Peça mudanças nos manifestos; o diagrama acompanha.",
  chatSuggestions: [
    "Adicione um cache Redis na frente do banco mais acessado",
    "Publique um evento quando um pedido mudar de status, para outras áreas consumirem",
    "Revise as relações contra as regras de topologia e EDA do opscr",
    "Quais elementos estão sem dono ou sem descrição?",
  ],
  chatClosed: "O painel opscr fechou a pasta antes da resposta chegar; nada foi alterado.",
  chatChanged: (added: string[], replaced: string[], deleted: string[]) =>
    [
      added.length ? `Adicionado: ${added.join(", ")}.` : "",
      replaced.length ? `Atualizado: ${replaced.join(", ")}.` : "",
      deleted.length ? `Removido: ${deleted.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  chatUnsaved: "Não salvo — mantenha ou descarte no canvas e salve no painel opscr.",
  chatRemainingErrors: "O opscr ainda aponta estes erros:",
  chatDiscardEdited:
    "Os manifestos mudaram depois desta resposta, então ela foi mantida — desfaça pelo texto ou pelo canvas.",
};

export const text = (locale: Locale) => (locale === "pt-BR" ? ptBR : en);
