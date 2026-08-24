# Tasks — Import ASL → Structura

Fatias pequenas e independentes. Cada uma termina verde (`npm run typecheck`,
`npm run test`, `npm run lint`, `npm run format:check`) e tem **critério observável
no canvas** — o que se vê na tela ao importar `/asl/example/solution.asl.yaml`,
salvo onde indicado.

**A Fatia 0 bloqueia todas as outras** (resolve a Decisão em aberto 1). A Fatia 7
depende da Decisão em aberto 7.

---

## Fatia 0 — Fixture de aceite (sem código de produção)

Resolve o risco R1: a regra de containment não está em nenhum schema ASL.

- [ ] Escrever o resultado esperado de `solution.asl.yaml` no canvas: quais nós
      existem, qual o tipo/ícone de cada um, quem está dentro de qual painel,
      quais arestas são desenhadas e quais não são (`belongsTo`, `appliesTo`).
- [ ] Confirmar com o autor do ASL qual das três hipóteses de containment vale:
      `belongsTo`, prefixo de sigla (`sigla` × `siglaApp`), ou outra regra.
      Registrar a resposta na `proposal.md` § Decisões em aberto, item 1.
- [ ] Congelar o resultado acordado como fixture de teste (arquivo ASL + estrutura
      esperada), ainda sem implementação.

**Critério observável:** existe um teste vermelho que nomeia, item a item, o
diagrama esperado — e a regra de containment deixou de ser suposição.

---

## Fatia 1 — Walking skeleton: do arquivo ao canvas

O menor caminho ponta a ponta. Sem containment, sem `BusinessRule`, sem validação
elaborada. Só: parse → mapa de tipos → arestas → ELK → store.

- [ ] Adicionar a dependência `yaml` e um `parse-asl.ts` em `src/lib/asl/` que lê
      multi-documento por `import()` dinâmico.
- [ ] Tipos do envelope + guard de `kind` para os 13 kinds (`asl.types.ts`).
- [ ] `asl-mapping.ts` com a tabela `(kind, provider)` → `{ type, service }` para
      `Application`, `Database`, `Queue`, `Topic`, `APIGateway`; providers fora dos
      catálogos degradam para `container` + `technology` (nunca ícone parecido).
- [ ] `Relationship.edges` → conexões, ignorando `belongsTo` e `appliesTo`.
- [ ] Layout: chamar o `layoutIR` existente por um adaptador temporário (a extração
      do engine neutro é a Fatia 8) e comitar via `insertGeneratedGraph`.
- [ ] Estender `GeneratedNodeInput` com `description?` e `tags?` (aditivo,
      opcional; o pipeline de IR não muda).
- [ ] Selecionar os componentes criados, como os demais fluxos de inserção.

**Critério observável no canvas:** importar `solution.asl.yaml` desenha 5 nós
técnicos conectados, fluindo da esquerda para a direita, com ícones corretos de
SQS, Lambda, DynamoDB e Kafka-como-container; um `Ctrl+Z` desfaz tudo de uma vez.

---

## Fatia 2 — Validador ASL

- [ ] `asl-validator.ts` no molde de `ir-validator.ts`: códigos de issue como
      sufixo i18n, coleta todas as issues, sem string visível no módulo puro.
- [ ] Checagens: `apiVersion`, `kind`, padrão de `metadata.name`, nome duplicado,
      `required` por kind, YAML malformado, documento sem `spec`.
- [ ] Resolução de `EndpointRef` por `id` **e** conferência do `kind` contra o
      manifest resolvido (`edgeEndpointNotFound`, `edgeKindMismatch`).
- [ ] Reusar `collectContainmentCycles` de `ir-validator.ts` (é puro; extrair para
      um módulo compartilhado em vez de copiar).
- [ ] Normalização em vez de rejeição: provider desconhecido degrada com aviso;
      kind sem contrapartida visual é ignorado com contagem no aviso.
- [ ] Chaves `aslImport.issue.*` em `en.json` e `pt-BR.json`.

**Critério observável no canvas:** um arquivo com erro estrutural mostra a lista de
problemas traduzida e o canvas continua exatamente como estava; um arquivo com
`provider: Nomad` importa normalmente, com o nó desenhado como container e um aviso
na tela.

---

## Fatia 3 — Containment e painéis

Depende da regra confirmada na Fatia 0.

- [ ] `asl-containment.ts`: cascata `belongsTo` → prefixo de sigla → único
      `ApplicationService` → raiz.
- [ ] `ApplicationService` → `PanelComponent` (`panelKind: default`), nome de
      `spec.displayName ?? metadata.name`.
- [ ] Filhos com posição relativa ao pai; painel recebe `width`/`height` do box do
      ELK; folhas não recebem tamanho.
- [ ] Container vazio: painel com o tamanho literal de boundary vazio, rótulo
      inteiro visível.
- [ ] Ciclo de containment vira issue de validação.

**Critério observável no canvas:** as duas aplicações aparecem **dentro** do painel
"SA Tracking de propostas de Consignado", o painel está dimensionado com folga em
volta dos filhos, e um arquivo sem aplicações ainda desenha o painel com o título
completo em vez de uma caixinha vazia.

---

## Fatia 4 — Rótulos e intent das conexões (decisão por medição)

Resolve o risco R2 e a Decisão em aberto 5.

- [ ] Medir `labelOverlaps` no arquivo de referência nas duas hipóteses: rótulo =
      `spec.description` completa vs. rótulo = verbo do `type`, com a descrição em
      `Connection.description`.
- [ ] Registrar a tabela comparativa no teste (impressa, no molde de
      `layoutReadability.options.test.ts`) e adotar a hipótese vencedora.
- [ ] Se nenhuma zerar: subir `nodeNodeBetweenLayers` e re-medir; só então
      considerar declarar labels como nós de rótulo no grafo ELK.
- [ ] Aplicar `intent` e `transportPreset` conforme a tabela de `design.md` §Q1.
- [ ] Ligar a ordem de handles vinda do ELK (padrão do projeto).

**Critério observável no canvas:** nenhum rótulo de aresta cobre outro rótulo nem
um nó; as conexões assíncronas/evento aparecem visualmente distintas das síncronas.

---

## Fatia 5 — BusinessRule como nota

- [ ] `BusinessRule` → `NoteComponent` com `spec.description` e as `constraints[]`
      em markdown (`name`, `condition`, `error`, `action` quando houver).
- [ ] A nota **não** entra no grafo do ELK; é posicionada depois, ancorada ao alvo
      de `appliesTo`, fora do bbox do layout.

**Critério observável no canvas:** a nota da regra aparece ao lado do painel do
serviço, com as 3 constraints legíveis em lista, e a geometria dos nós técnicos é
idêntica à da Fatia 4 (a nota não empurrou nada).

---

## Fatia 6 — Metadados

- [ ] `metadata.labels` → `tags` no formato `chave:valor`.
- [ ] `spec.displayName` / `metadata.name` / `spec.description` conforme a spec.
- [ ] `metadata.annotations`: implementar a opção escolhida na Decisão em aberto 6,
      ou registrar por que ficou de fora.
- [ ] Aviso contando manifests ignorados (camada de negócio, `Squad`, `Community`).

**Critério observável no canvas:** selecionar o `ApplicationService` mostra no
painel de propriedades as tags `domain:consignado` e `tier:critical`, e a descrição
de cada nó técnico vem do `spec.description` do manifest.

---

## Fatia 7 — UI de importação

Depende da Decisão em aberto 7 (fundir no diagrama ativo vs. criar diagrama novo).

- [ ] Aceitar `.asl.yaml` e `.yaml` no fluxo de import existente (`ImportModal`),
      incluindo arrastar e soltar.
- [ ] Sniffing de conteúdo para distinguir ASL de outros YAML, pela linha
      `apiVersion: arquitetura.itau/v1`.
- [ ] Toasts de sucesso, aviso e erro, todos por i18n em `en` e `pt-BR`.

**Critério observável no canvas:** arrastar `solution.asl.yaml` para a janela de
import desenha o diagrama e mostra um toast com a contagem de elementos criados e
de manifests ignorados.

---

## Fatia 8 — Engine de layout neutro (extração)

- [ ] Extrair `graphLayoutEngine.ts` a partir de `irLayoutEngine.ts`, recebendo
      `{ id, parentId, isContainer, width?, height? }` + arestas.
- [ ] `layoutIR` vira adaptador fino; o ASL passa a ser o segundo cliente.
- [ ] Manter `readLaidOutGraph` (correção de LCA) e `readElkHandleOrder` como
      estão — reuso, não reescrita.

**Critério observável no canvas:** gerar um diagrama pelo `/generate` do chat
produz exatamente o mesmo desenho de antes, e
`layoutReadability.baseline.test.ts` passa sem alterar nenhum número do baseline.

---

## Fatia 9 — Harness de legibilidade do ASL

- [ ] Fixtures: arquivo de referência, container vazio, leque de saída largo,
      rótulos longos.
- [ ] Suíte de baseline no molde de `layoutReadability.baseline.test.ts`,
      imprimindo a tabela e falhando se algum número piorar.
- [ ] Medir também o caminho renderizado (`renderedEdgePath`), não só a rota do
      ELK — é o que o usuário vê.

**Critério observável no canvas:** os quatro fixtures abrem no canvas sem
sobreposição de nó ou de rótulo, e a tabela impressa pelo teste bate com o que está
na tela.

---

## Fatia 10 — Documentação e política de fidelidade

- [ ] `docs/concepts/import-export.md`: ASL na tabela de formatos, direção
      "import" apenas, e a perda declarada (camada de negócio, organização,
      re-import não idempotente).
- [ ] Registrar a recomendação sobre Structura → ASL e o que a destravaria.
- [ ] ADR novo **apenas** se a Decisão em aberto 9 for resolvida nesta rodada.

**Critério observável:** um leitor da doc consegue dizer, sem abrir o código, o que
sobrevive a uma importação ASL e o que não sobrevive.

---

## Fora desta lista

- Structura → ASL (Decisão em aberto 9).
- Re-import idempotente / upsert por `metadata.name` (risco R5).
- Geração de ASL por LLM e superfície MCP.
- Qualquer alteração em Mermaid, draw.io ou no JSON nativo.
