## Why

O ASL (Architecture as Language) é um formato declarativo próprio, inspirado em
manifests do Kubernetes (`apiVersion` / `kind` / `metadata` / `spec`), para
descrever soluções de arquitetura. Os schemas vivem em `/asl/*.yaml` (13 kinds) e
o caso de referência é `/asl/example/solution.asl.yaml` — um YAML multi-documento
com 8 manifests.

Hoje não há caminho do ASL para o canvas. O Structura já tem dois pares de
interchange (Mermaid e draw.io) e um pipeline de geração por LLM que resolve
exatamente o mesmo problema estrutural — grafo sem geometria → diagrama legível —
via IR + ELK (`src/features/llm/ir/`, `src/features/canvas/layout/`). Falta o
adaptador do ASL para essa maquinaria.

O que torna o ASL diferente dos formatos já suportados, e por isso não é um
"mais um importer":

- **O ASL não tem geometria nenhuma.** Nenhum schema em `/asl/*.yaml` declara
  posição, tamanho, ordem ou layout. Mermaid tem ordem textual; draw.io tem
  `mxGeometry` literal. O ASL é 100 % estrutural — como o IR do LLM. A geometria
  precisa ser **calculada**, não traduzida.
- **O ASL não declara containment.** Não existe campo `parent` em lugar nenhum.
  A hierarquia precisa ser **derivada** (ver Decisão em aberto 1), e o critério
  de aceite do produto exige containment correto.
- **O ASL mistura camada de negócio e camada técnica** no mesmo arquivo
  (`BusinessCapability`, `BusinessService`, `ServiceOffer`, `Squad`, `Community`,
  `BusinessRule` ao lado de `Application`, `Database`, `Queue`, `Topic`,
  `APIGateway`). Nem tudo tem contrapartida visual.
- **Os providers do ASL não são só AWS.** `OpenShift`, `VM`, `Kong On-premise`,
  `IBM MQ`, `CosmosDB`, `Kafka` aparecem nos enums; o catálogo AWS não os cobre.

O critério de aceite é de produto, não de engenharia: importar
`solution.asl.yaml` tem que produzir um diagrama **bem dimensionado e legível** —
containment correto, sem sobreposição de nós ou de rótulos, leitura clara da
esquerda para a direita. Uma "sopa de nós soltos" é falha da fatia, não um
detalhe a polir depois.

## What Changes

- **Novo módulo de interchange puro `src/lib/asl/`** — parse YAML multi-documento,
  validação do envelope + spec por kind, e mapeamento ASL → um plano neutro de
  importação. Sem dependência de `@/features/*`, na linha do ADR-0006 ("format
  knowledge never leaks inward") e do `export-core` do ADR-0009.
- **Nova dependência: parser YAML.** O repo **não tem nenhum parser YAML hoje**
  (verificado em `package.json`). Recomendação: `yaml` (ESM, `parseAllDocuments`,
  reporta linha/coluna por documento), carregado por `import()` dinâmico como já
  se faz com `elkjs` e `monaco`, para não entrar no bundle inicial.
- **Validador ASL espelhando a arquitetura do `ir-validator.ts`** — códigos de
  issue que servem de sufixo de chave i18n (`aslImport.issue.<code>`), coleta de
  todos os problemas em vez de falhar no primeiro, e normalização em vez de
  rejeição sempre que o manifest ainda é renderizável.
- **Motor de layout ELK compartilhado.** `irLayoutEngine.ts` é generalizado para
  aceitar um grafo neutro (`{ id, parentId, isContainer, width?, height? }` +
  arestas) em vez de `DiagramIR`, e o pipeline do LLM passa a ser um dos dois
  clientes. Extração, não cópia; o baseline de legibilidade existente
  (`layoutReadability.baseline.test.ts`) é a trava de regressão.
- **Containment real em panels**, incluindo containers vazios: `ApplicationService`
  vira `PanelComponent` e os `Application` que lhe pertencem entram como filhos.
  Um `ApplicationService` sem aplicações continua desenhado como painel.
- **Commit via `insertGeneratedGraph`** (slice existente) — a importação inteira é
  **um único passo de undo**, como toda geração/import do produto. Requer duas
  extensões pequenas em `GeneratedNodeInput`: `description` e `tags`, que hoje não
  existem e são justamente o que o ASL carrega.
- **Harness de legibilidade específico do ASL** — os fixtures do ASL entram no
  mesmo instrumento que já mede o pipeline do LLM (`layoutReadability.ts`,
  `renderedEdgePath.ts`) com baseline registrada, exatamente como
  `layoutReadability.baseline.test.ts`.
- **UI de import** — extensões `.asl.yaml` / `.yaml` no fluxo de import existente,
  com strings em `en` e `pt-BR`.
- **Direção Structura → ASL fica fora desta mudança**, com recomendação
  justificada e a costura reservada (ver Decisão em aberto 9 e `design.md` §Q4).

## Capabilities

### New Capabilities

- **asl-import**: converter um documento ASL multi-manifest em componentes,
  conexões e containment do Structura, com validação de entrada não-silenciosa e
  commit em um único passo de undo. Cria `specs/asl-import/spec.md`.
- **asl-layout-legibility**: garantir que o diagrama importado seja legível —
  geometria calculada por ELK, containment dimensionado, rótulos que não se
  sobrepõem — e que problemas de qualidade visual virem **aviso, nunca bloqueio**.
  Cria `specs/asl-layout-legibility/spec.md`.

## Impact

- **Arquivos novos**
  - `src/lib/asl/asl.types.ts` — tipos dos 13 kinds + envelope + guards por kind.
  - `src/lib/asl/parse-asl.ts` — YAML multi-documento → manifests brutos.
  - `src/lib/asl/asl-validator.ts` — issues + normalização (padrão `ir-validator`).
  - `src/lib/asl/asl-mapping.ts` — tabela kind + provider → tipo de componente,
    `panelKind`, serviço de nuvem; tabela `Relationship.type` → intent/label.
  - `src/lib/asl/asl-containment.ts` — derivação de hierarquia.
  - `src/lib/asl/asl-to-plan.ts` — manifests validados → plano neutro de importação.
  - `src/features/diagram/utils/import-asl.ts` — adaptador plano → store; roda o
    layout e comita via `insertGeneratedGraph`.
  - `src/features/canvas/layout/graphLayoutEngine.ts` — engine ELK neutro
    (extraído de `irLayoutEngine.ts`).
  - Fixtures ASL + baseline de legibilidade em `src/features/canvas/layout/`.
- **Arquivos alterados**
  - `src/features/canvas/layout/irLayoutEngine.ts` — passa a ser um adaptador fino
    sobre o engine neutro; comportamento e baseline inalterados.
  - `src/features/diagram/store/slices/generated-graph.slice.ts` — `GeneratedNodeInput`
    ganha `description?` e `tags?`.
  - `src/pages/ImportModal.tsx` (+ o fluxo de import que o chama) — aceitar ASL.
  - `src/infrastructure/i18n/locales/en.json` e `pt-BR.json` — bloco `aslImport`.
  - `package.json` — dependência `yaml`.
- **Documentação**
  - `docs/concepts/import-export.md` — ASL na tabela de formatos e na política de
    fidelidade declarada (import-only na v1).
  - `docs/adr/` — ADR novo apenas se a Decisão em aberto 9 (round-trip / metadata
    bag persistida) for resolvida nesta rodada; caso contrário, não.
- **Sem impacto** em Mermaid, draw.io, JSON nativo, colaboração, plugins.

## Decisões em aberto

Registradas porque o código e o exemplo disponíveis **não as respondem**. Nenhuma
delas foi assumida silenciosamente no plano.

> **Resolvidas em 2026-08-24, antes da implementação** (itens 1, 2, 3 e 7):
>
> - **1 — containment:** cascata `belongsTo` → prefixo de sigla → único
>   `ApplicationService` → raiz.
> - **2 — infraestrutura:** `Database`, `Queue`, `Topic` e `APIGateway` ficam
>   **fora** do painel; só entram por `belongsTo` explícito.
> - **3 — camada de negócio:** `BusinessCapability`, `BusinessService` e
>   `ServiceOffer` viram **notas ancoradas**, fora do grafo do ELK — mesmo
>   tratamento dado ao `BusinessRule`.
> - **7 — destino do import:** funde no diagrama ativo, um único passo de undo,
>   como draw.io e Mermaid.
>
> As demais (4, 5, 6, 8, 9) seguem com o default do plano.

1. **Qual é a regra de containment do ASL?** (maior risco — ver `design.md` §Q7)
   Nenhum schema declara `parent`. Existem três candidatos, em ordem de força de
   evidência: (a) `Relationship.type: belongsTo` — único termo do vocabulário cujo
   significado é containment, mas **não usado no exemplo**; (b) convenção de sigla
   — o `ApplicationService` tem `spec.sigla: JX9` e as duas `Application` têm
   `siglaApp: JX9-X000` / `JX9-X001`, o que é um sinal real de pertencimento no
   caso concreto, mas lido de **um** arquivo e não documentado no schema;
   (c) `metadata.labels.domain` como agrupamento. **Precisa de confirmação sua.**
2. **Recursos de infraestrutura ficam dentro ou fora do painel do
   `ApplicationService`?** `Database`, `Queue`, `Topic` e `APIGateway` podem ser
   compartilhados entre serviços; colocá-los dentro afirma uma posse que o arquivo
   não declara. É julgamento de modelagem, não fato de código.
3. **A camada de negócio é desenhada?** `BusinessCapability`, `BusinessService`,
   `ServiceOffer` não têm contrapartida visual óbvia e, desenhadas como nós,
   produzem um segundo grafo desconexo ao lado do técnico. Opções: painel externo,
   nota, ou apenas metadado do diagrama.
4. **`Squad` e `Community` viram o quê?** São posse organizacional, não topologia.
   `ServiceDefinition` (catálogo de serviços) já tem `owner` e `tags` — pode ser o
   destino certo, em vez de virar nó.
5. **Rótulo da aresta: verbo ou descrição?** As `description` do exemplo têm 40–60
   caracteres em pt-BR. Decisão a ser tomada **por medição** na Fatia 4, não por
   gosto (ver `design.md` §Q2, risco R2).
6. **`metadata.annotations` vai para onde?** `description`, `tags` ou
   `externalLinks` (ex.: `contact:` como `mailto:`)? O modelo não tem um saco de
   metadados genérico.
7. **Import cria diagrama novo ou funde no ativo?** draw.io e Mermaid fundem no
   diagrama ativo; o JSON de workspace cria. Um arquivo ASL descreve uma solução
   inteira, o que sugere criar — mas isso muda o fluxo de UI.
8. **Biblioteca YAML.** Recomendação `yaml`; alternativa `js-yaml`. Fica registrada
   porque adiciona dependência de runtime ao produto.
9. **Structura → ASL.** Recomendação: **fora de escopo agora** (justificativa
   completa em `design.md` §Q4). Reavaliar só se/quando existir um lugar
   persistido para guardar o `spec` do ASL — o que exige bump de
   `PERSIST_SCHEMA_VERSION` e migração.

## Non-Goals

- **Nenhuma implementação nesta rodada.** Esta mudança entrega spec, design e
  tasks; o código vem em prompts/sessões separadas por fatia.
- **Nenhum caminho Structura → ASL.** Só a recomendação e a costura reservada.
- **Nenhuma alteração em Mermaid ou draw.io**, nem no `export-core`, nem no
  formato JSON nativo.
- **Nenhuma mudança de comportamento no pipeline de geração por LLM.** A extração
  do engine de layout é comportamento-idêntica e travada pelo baseline existente.
- **Nenhum round-trip nem re-import idempotente.** Reimportar um ASL atualizado
  duplica o conteúdo na v1; isso é declarado, não resolvido (risco R5).
- **Nenhuma superfície MCP / geração de ASL por LLM.** É um bom próximo passo, mas
  é outra mudança.
- **Nenhum validador de ASL como produto** (linter de manifests, CLI). A validação
  existe a serviço do import.
- **Nenhum suporte a `$ref` entre arquivos ASL** nem a diretórios de manifests: a
  unidade é um arquivo multi-documento.
