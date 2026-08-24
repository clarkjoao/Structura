# asl-import Specification

## Purpose

Converter um documento ASL (Architecture as Language) — YAML multi-manifest no
padrão `apiVersion` / `kind` / `metadata` / `spec` definido em `/asl/*.yaml` — em
componentes, conexões e containment do Structura, com validação de entrada que
nunca falha em silêncio e commit em um único passo de undo.

## Requirements

### Requirement: Parse de YAML multi-documento

O sistema DEVE aceitar um arquivo ASL contendo múltiplos manifests separados por
`---` e produzir uma lista ordenada de manifests brutos, preservando a posição de
cada documento para relato de erro. O parser YAML DEVE ser carregado por `import()`
dinâmico, para não entrar no bundle inicial (mesma política de `elkjs` e `monaco`).

#### Scenario: Arquivo de referência é parseado por completo

- **GIVEN** o arquivo `/asl/example/solution.asl.yaml`
- **WHEN** o parser roda sobre o conteúdo
- **THEN** 8 manifests são reconhecidos, na ordem do arquivo
- **AND** cada um expõe `apiVersion`, `kind`, `metadata` e `spec`

#### Scenario: YAML malformado não derruba o import

- **GIVEN** um arquivo cujo terceiro documento tem indentação inválida
- **WHEN** o parser roda
- **THEN** o resultado reporta uma issue apontando o índice do documento
- **AND** nenhum componente é escrito no store

#### Scenario: Documento vazio é ignorado

- **GIVEN** um arquivo terminado com `---` e nada depois
- **WHEN** o parser roda
- **THEN** o documento vazio é descartado sem gerar issue

### Requirement: Validação do envelope e do spec por kind

O sistema DEVE validar cada manifest e DEVE coletar **todas** as issues em vez de
parar na primeira. Cada issue DEVE ser identificada por um código que serve de
sufixo de chave i18n (`aslImport.issue.<code>`), mantendo o módulo de validação
livre de strings visíveis ao usuário — mesmo contrato de `ir-validator.ts`.

A validação DEVE checar: `apiVersion` na allow-list (`arquitetura.itau/v1`), `kind`
na allow-list dos 13 kinds, `metadata.name` no padrão `^[a-z][a-z0-9_-]*$`,
unicidade de `metadata.name` entre documentos, e os campos `required` do schema de
cada kind.

#### Scenario: Todas as issues são reportadas de uma vez

- **GIVEN** um arquivo com um `apiVersion` desconhecido e um `metadata.name` fora do padrão
- **WHEN** a validação roda
- **THEN** as duas issues aparecem no resultado
- **AND** cada uma traz o código e os parâmetros de interpolação da mensagem

#### Scenario: Nome duplicado é erro

- **GIVEN** dois manifests com o mesmo `metadata.name`
- **WHEN** a validação roda
- **THEN** uma issue `duplicateName` é reportada com o nome em conflito
- **AND** nada é escrito no store

#### Scenario: Campo required ausente é erro

- **GIVEN** um manifest `Application` sem `spec.provider`
- **WHEN** a validação roda
- **THEN** uma issue nomeando o kind, o `metadata.name` e o campo ausente é reportada

### Requirement: Valor desconhecido normaliza em vez de rejeitar

Quando um manifest continua renderizável, o sistema DEVE normalizar e emitir aviso
em vez de rejeitar. Um `provider` fora do enum DEVE degradar para um componente C4
`container` com o valor cru em `technology`, acompanhado de um aviso. Um `kind`
sem contrapartida visual DEVE ser ignorado com aviso informando quantos manifests
foram ignorados. Um valor desconhecido NÃO DEVE, em nenhum caso, abortar o import
inteiro.

#### Scenario: Provider desconhecido vira container com aviso

- **GIVEN** um `Application` com `provider: Nomad`
- **WHEN** o import roda
- **THEN** um nó `container` chamado pelo `displayName` do manifest aparece no canvas
- **AND** seu `technology` é `"Nomad"`
- **AND** o import termina com sucesso e exibe um aviso

#### Scenario: Kinds de negócio ignorados são contados

- **GIVEN** um arquivo com dois `BusinessCapability` e um `ServiceOffer`
- **WHEN** o import roda com a camada de negócio desativada
- **THEN** o import conclui e exibe um aviso informando 3 manifests ignorados

### Requirement: Referências de Relationship são resolvidas pela chave composta

`Relationship.spec.edges[].from` e `.to` são `EndpointRef { kind, id }`, onde `id`
é o `metadata.name` de outro manifest. O sistema DEVE resolver a referência pelo
`id` e DEVE conferir que o `kind` declarado bate com o do manifest resolvido, como
o schema exige ("asserted against the resolved component").

#### Scenario: Referência inexistente é issue

- **GIVEN** uma aresta apontando para `id: app-que-nao-existe`
- **WHEN** a validação roda
- **THEN** uma issue `edgeEndpointNotFound` nomeia a aresta e a referência

#### Scenario: Kind inconsistente é issue

- **GIVEN** uma aresta com `{ kind: Database, id: app-tracking-consignado }`, onde esse nome é um `Application`
- **WHEN** a validação roda
- **THEN** uma issue `edgeKindMismatch` nomeia o kind declarado e o kind resolvido

### Requirement: Mapeamento de kind e provider para tipo de componente

O sistema DEVE mapear cada manifest desenhável para um `ComponentType` do
Structura, usando a tabela de `design.md` §Q1. O par `(kind, provider)` DEVE
determinar o tipo e o id de serviço de nuvem; providers que não correspondem a um
serviço de catálogo DEVEM degradar para `container` com o provider em `technology`,
e NÃO DEVEM ser mapeados para um serviço de nuvem de nome parecido. Type guards
(`isPanelType`, `isAwsType`, …) DEVEM ser usados no lugar de comparação de string
crua, conforme regra dura do `AGENTS.md`.

#### Scenario: Application Lambda vira nó de compute com ícone

- **GIVEN** um `Application` com `provider: Lambda` e `language: Python`
- **WHEN** o import roda
- **THEN** o nó tem tipo `aws-compute` e serviço `lambda`
- **AND** seu `technology` é `"Python"`

#### Scenario: Database DynamoDB vira nó de banco com ícone

- **GIVEN** um `Database` com `provider: DynamoDB`
- **WHEN** o import roda
- **THEN** o nó tem tipo `aws-database` e serviço `dynamodb`

#### Scenario: Database CosmosDB usa o catálogo Azure

- **GIVEN** um `Database` com `provider: CosmosDB`
- **WHEN** o import roda
- **THEN** o nó tem tipo `azure-database` e serviço `cosmosdb`

#### Scenario: IBM MQ não recebe o ícone do Amazon MQ

- **GIVEN** um `Queue` com `provider: IBM MQ`
- **WHEN** o import roda
- **THEN** o nó tem tipo `container` e `technology: "IBM MQ"`
- **AND** nenhum serviço de nuvem é atribuído

### Requirement: Mapeamento de Relationship para conexões

Cada `edge` de um manifest `Relationship` cujo `type` denote fluxo DEVE virar uma
`Connection`, com `intent` e `transportPreset` conforme a tabela de `design.md`
§Q1. Os tipos `belongsTo` e `appliesTo` NÃO DEVEM virar arestas de fluxo:
`belongsTo` DEVE virar containment e `appliesTo` DEVE virar ancoragem de nota.

#### Scenario: triggers vira conexão de evento

- **GIVEN** uma aresta `Queue → Application` com `type: triggers`
- **WHEN** o import roda
- **THEN** existe uma conexão da fila para a aplicação
- **AND** seu `intent` é `event`

#### Scenario: writes vira conexão de fluxo de dados

- **GIVEN** uma aresta `Application → Database` com `type: writes`
- **WHEN** o import roda
- **THEN** a conexão tem `intent: data-flow`

#### Scenario: belongsTo não desenha aresta

- **GIVEN** uma aresta com `type: belongsTo` entre uma `Application` e um `ApplicationService`
- **WHEN** o import roda
- **THEN** nenhuma conexão é criada entre os dois
- **AND** a aplicação aparece dentro do painel do serviço

#### Scenario: appliesTo não desenha aresta de fluxo

- **GIVEN** uma aresta `BusinessRule → ApplicationService` com `type: appliesTo`
- **WHEN** o import roda
- **THEN** nenhuma conexão de fluxo é criada
- **AND** a nota da regra é posicionada junto ao alvo

### Requirement: Metadados do manifest chegam ao componente

O sistema DEVE preencher `name` a partir de `spec.displayName` quando presente e de
`metadata.name` caso contrário; `description` a partir de `spec.description`; e
`tags` a partir de `metadata.labels`, no formato `chave:valor`.

#### Scenario: displayName vence metadata.name

- **GIVEN** um `ApplicationService` com `metadata.name: sa-proposal-consignado-tracking-clt` e `spec.displayName: "SA Tracking de propostas de Consignado"`
- **WHEN** o import roda
- **THEN** o painel exibe `SA Tracking de propostas de Consignado`

#### Scenario: Labels viram tags

- **GIVEN** um manifest com `labels: { domain: consignado, tier: critical }`
- **WHEN** o import roda
- **THEN** o componente tem as tags `domain:consignado` e `tier:critical`

### Requirement: BusinessRule vira nota com as constraints em markdown

Um manifest `BusinessRule` DEVE virar um `NoteComponent` cujo conteúdo apresenta
`spec.description` e a lista de `spec.constraints[]` (`name`, `condition`, `error`
e `action` quando presente) em markdown, que `NoteNode` já renderiza.

#### Scenario: A regra do arquivo de referência vira uma nota legível

- **GIVEN** o `BusinessRule` `regra-tracking-consignado`, com 3 constraints
- **WHEN** o import roda
- **THEN** existe uma nota no canvas com as 3 constraints listadas
- **AND** a constraint que tem `action` mostra também esse campo

### Requirement: A importação é um único passo de undo

O sistema DEVE comitar todo o resultado — componentes, conexões, layouts e
containment — através de `insertGeneratedGraph`, que chama `pushHistory` uma única
vez. Um `Ctrl+Z` DEVE reverter a importação inteira.

#### Scenario: Um undo desfaz o import inteiro

- **GIVEN** um diagrama vazio
- **WHEN** o usuário importa `solution.asl.yaml` e pressiona desfazer uma vez
- **THEN** o canvas volta a ficar vazio

#### Scenario: Import inválido não deixa resíduo

- **GIVEN** um arquivo ASL com issue estrutural
- **WHEN** o usuário tenta importar
- **THEN** nenhum componente ou conexão é criado
- **AND** nenhuma entrada de histórico é empilhada

### Requirement: Elementos importados ficam selecionados

Após um import bem-sucedido, o sistema DEVE selecionar os componentes criados,
como fazem os demais fluxos de inserção do produto (atalhos C4, Pattern Picker,
import de Mermaid/draw.io, geração por IR).

#### Scenario: Seleção após o import

- **WHEN** o import de `solution.asl.yaml` conclui
- **THEN** todos os componentes criados aparecem selecionados no canvas

### Requirement: Toda string visível passa por i18n em en e pt-BR

Mensagens de issue, avisos e textos de UI do import ASL DEVEM ser resolvidos por
`t("...")`, com entradas presentes tanto em `en.json` quanto em `pt-BR.json`. Os
módulos puros de parse, validação e mapeamento NÃO DEVEM conter strings visíveis
ao usuário — apenas códigos de issue.

#### Scenario: Nenhuma chave faltando

- **WHEN** a suíte de testes de i18n roda
- **THEN** toda chave `aslImport.*` usada no código existe em `en.json` e em `pt-BR.json`

### Requirement: O módulo de conversão é puro e não conhece o store

O código de parse, validação e mapeamento DEVE viver em `src/lib/asl/` e NÃO DEVE
importar de `@/features/*` nem tocar em `localStorage` — persistência só via
`IStoragePort` e apenas na camada que já a usa. A escrita no store acontece
exclusivamente no adaptador em `src/features/diagram/utils/`.

#### Scenario: Guarda de dependência

- **WHEN** o teste de fronteira do módulo roda
- **THEN** nenhum arquivo de `src/lib/asl/**` importa de `@/features/`
- **AND** nenhum deles referencia `localStorage`
