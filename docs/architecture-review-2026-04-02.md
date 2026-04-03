# Revisão Arquitetural Profunda — Structura (React + TypeScript)

Data: 2026-04-02

## 1) Resumo executivo da saúde arquitetural

**Diagnóstico geral:** o projeto está em um nível **bom para avançado**, com uma base de domínio forte (tipagem rica, guards, store central, slices, utilitários puros e separação inicial entre `features`, `integrations` e `infrastructure`).

**Ponto forte principal:** você já possui um “núcleo de domínio” consistente em `features/diagram`, com muitos utilitários puros e boa modelagem de tipos.

**Débito principal atual:** existem áreas críticas onde **lógica de negócio e orquestração de integração vazaram para UI/hooks de tela**, criando acoplamento e dificultando testes unitários e evolução incremental.

**Saúde arquitetural (pragmática):**
- Domínio modelado: **8/10**
- Fronteiras de camada (UI x regra x integração): **5/10**
- Coesão dos módulos críticos (canvas/dashboard/integrations): **5/10**
- Legibilidade/manutenibilidade em fluxos grandes: **6/10**
- Testabilidade da regra de negócio fora de React: **5/10**

---

## 2) Principais problemas encontrados

### Alta prioridade

#### AP-1 — Hook de integração com múltiplas responsabilidades (`useGithubImport`)
**Problema**
- O hook concentra: estado de UI, paginação, validação de entrada, busca HTTP, detecção de conflito, regra de priorização de conflito, auto-resolução e commit em store.

**Por que atrapalha**
- Mudanças de regra de merge/import exigem mexer em hook React + efeitos colaterais + estado visual.
- Dificulta testes de regra sem render de hook.

**Princípios violados**
- SRP (SOLID), Separation of Concerns, Boundary UI ↔ use case.

**Como refatorar (incremental)**
1. Extrair `buildImportPlan(...)` (função pura) para montar:
   - conflitos relevantes,
   - auto-resolutions,
   - decisões de prioridade.
2. Criar `executeGithubImport(plan, deps)` como **use case de aplicação** (sem React).
3. Deixar o hook apenas como adaptador de estado e chamada dos casos de uso.

**Impacto esperado**
- Menos regressão em import/merge.
- Testes unitários rápidos de regra de negócio.

---

#### AP-2 — `DetailPanel` mistura renderização + integração remota + merge de dados + persistência
**Problema**
- O componente executa sincronização GitHub/DefectDojo, parsing de metadados, merge de tecnologia/tags/sources e update de serviço.

**Por que atrapalha**
- Painel fica grande e “frágil”; qualquer ajuste de integração impacta UX local.
- Alto custo cognitivo para manutenção.

**Princípios violados**
- SRP, DIP (UI depende de detalhes de cliente/infra), Clean Architecture (regra de aplicação no componente).

**Como refatorar (incremental)**
1. Criar `syncServiceFromSources(service, deps)` em `features/registry/application/use-cases`.
2. Mover merge e prioridade de campos para `domain/service-merge.ts` (puro).
3. Componente só dispara `onSync(serviceId)` e exibe resultado.

**Impacto esperado**
- Painel menor, legível, mais testável.
- Reuso da sincronização em outros pontos (batch sync, command palette etc.).

---

#### AP-3 — “Domínio puro” acoplado a catálogo/i18n/infra em `components.slice`
**Problema**
- O slice de domínio importa catálogo AWS/panels e `i18n`, logo depende de infraestrutura/detalhes de apresentação para construir entidades.

**Por que atrapalha**
- Contradição com a intenção de domínio isolado.
- Regras de criação ficam difíceis de executar/testar em ambiente neutro.

**Princípios violados**
- Dependency Rule (Clean Architecture), DIP.

**Como refatorar (incremental)**
1. Extrair `ComponentFactory` pura com dependências injetadas:
   - `labelProvider` (strings default),
   - `panelDefaultsProvider`,
   - `awsTypeResolver`.
2. Slice chama factory via dependências configuradas no “composition root”.

**Impacto esperado**
- Domínio realmente desacoplado.
- Testes puros de regras de criação/layout inicial.

---

#### AP-4 — `useFileSystemStorage` concentra estado de UI + boot + merge + sync + persistência
**Problema**
- Hook de infraestrutura com orquestração longa e múltiplos fluxos transacionais (connect/merge/overwrite/disconnect/backup).

**Por que atrapalha**
- Alto risco de regressão; difícil simular cenários em teste.

**Princípios violados**
- SRP, baixa coesão.

**Como refatorar (incremental)**
1. Extrair casos de uso:
   - `connectWorkspace`;
   - `mergeWorkspace`;
   - `overwriteWorkspace`;
   - `disconnectWorkspace`.
2. Manter hook apenas como adaptador de estado e ações.

**Impacto esperado**
- Fluxos críticos de persistência previsíveis e testáveis.

---

### Média prioridade

#### MP-1 — Canvas com orquestração grande em vários pontos (`Canvas`, `useCanvasInteraction`, `useCanvasKeyboard`)
**Problema**
- Apesar da divisão em hooks, alguns contratos ficaram muito largos (muitos parâmetros/handlers), indicando fronteira ainda difusa entre interação de UI e regras operacionais.

**Por que atrapalha**
- Evolução de atalho/seleção/edição exige tocar em muitos arquivos acoplados por assinatura extensa.

**Como refatorar (incremental)**
1. Introduzir `CanvasCommandBus` (simples):
   - UI dispara comandos (`ADD_NODE`, `SELECT_NODE`, `PASTE_SVG`),
   - handlers aplicam regra usando actions/store.
2. Separar `keyboard` em módulos por contexto de permissão:
   - `editingCommands`, `navigationCommands`, `recordingCommands`.

**Impacto esperado**
- Menos acoplamento entre teclas/eventos e lógica de negócio.

---

#### MP-2 — Página de dashboard com muita regra embutida no componente
**Problema**
- Busca global, ordenação, filtros, bulk actions e navegação centralizadas em um único componente grande.

**Como refatorar (incremental)**
- Extrair `useDashboardViewModel` (orquestração).
- Extrair funções puras para filtro/ordenação/bulk-plan.

**Impacto esperado**
- Reduz complexidade da página e facilita testes de regra sem DOM.

---

#### MP-3 — Inconsistência i18n (strings hardcoded ainda presentes)
**Problema**
- Alguns textos visíveis continuam hardcoded em componentes.

**Como refatorar**
- Migrar todos para chaves i18n e validar por lint custom ou teste snapshot de strings.

**Impacto esperado**
- Consistência de UX e internacionalização sem “ilhas” de português fixo.

---

### Baixa prioridade

#### BP-1 — Componente declarado dentro de componente (`MainPages` em `App`)
**Problema**
- Padrão pode provocar recriação desnecessária e piorar legibilidade.

**Como refatorar**
- Mover `MainPages` para componente externo no mesmo arquivo (ou módulo próprio).

---

#### BP-2 — API de hooks com muitos argumentos posicionais
**Como melhorar**
- Em contratos longos, prefira objetos de dependência segmentados (`actions`, `permissions`, `selectionState`, `callbacks`).

---

#### BP-3 — Cobertura de testes concentrada em utilitários, pouca cobertura de orquestração
**Como melhorar**
- Adicionar testes de aplicação (use cases) para import/sync/workspace/canvas commands.

---

## 3) Sugestões de desacoplamento (aplicáveis)

### 3.1 Extrair casos de uso explícitos (sem exagero de camadas)
Sugestão pragmática: adotar “Clean Architecture **light**” apenas nos fluxos críticos.

```text
features/
  registry/
    application/
      use-cases/
        syncServiceFromSources.ts
        importGithubRepositories.ts
      ports/
        github.port.ts
        defectdojo.port.ts
        service-repository.port.ts
    domain/
      serviceMerge.ts
      serviceSource.ts
    ui/
      DetailPanel.tsx
      hooks/useServiceSync.ts
```

**Regra prática:** se envolver decisão de negócio + integração externa + escrita em store, extraia para `application/use-cases`.

---

### 3.2 Padronizar “UI fina + hook fino + use case grosso (puro)”
- **UI**: renderiza e dispara intenções.
- **Hook de tela**: estado efêmero de UX (open/close/loading local).
- **Use case**: regras e decisões de negócio/orquestração.
- **Adapter**: HTTP/localStorage/github client.

---

### 3.3 Tratar store actions como “porta de escrita”
- Em vez de chamar `useRegistryActions` profundamente em múltiplos hooks, injete uma interface mínima (`ServiceWritePort`) no caso de uso.
- Isso reduz dependência direta do Zustand em regras de negócio.

---

### 3.4 Criar “políticas” puras para fluxos complexos
- `resolveConflictPriority(...)`
- `mergeServiceDataPolicy(...)`
- `shouldAutoResolveConflict(...)`

Todas testáveis sem React.

---

## 4) Proposta de arquitetura/padrões mais adequados

### Recomendada (equilibrada para React + TS)

```text
src/
  features/
    <feature>/
      ui/               # componentes React
      hooks/            # hooks de apresentação/orquestração local
      application/      # use cases (regras + orquestração)
      domain/           # tipos, políticas e funções puras
      infrastructure/   # adapters específicos da feature (quando necessário)
```

### O que **não** fazer
- Não introduzir DI container complexo.
- Não criar dezenas de interfaces para fluxos simples de UI.

### O que **fazer**
- Aplicar essa estrutura apenas onde há alta volatilidade/regra (canvas interactions, registry sync/import, filesystem workspace).

---

## 5) Refatorações incrementais recomendadas

### Sprint 1 (alto valor, baixo risco)
1. Extrair casos de uso puros do GitHub import (`buildImportPlan`, `executeImportPlan`).
2. Extrair `syncServiceFromSources` do `DetailPanel`.
3. Mover hardcoded strings do painel GitHub para i18n.

### Sprint 2 (estabilidade arquitetural)
4. Quebrar `useFileSystemStorage` em use cases de conexão/merge/overwrite.
5. Criar testes unitários dos use cases extraídos.

### Sprint 3 (ergonomia de canvas)
6. Introduzir `CanvasCommandBus` simples e migrar atalhos por domínio de comando.
7. Reduzir assinatura do `useCanvasKeyboard` em blocos (`selection`, `editing`, `clipboard`, `navigation`).

---

## 6) Quick wins de legibilidade e manutenção

1. Padronizar nomes de handlers:
   - `handleX` para UI
   - `executeX` para regra de aplicação
   - `resolveX` para política pura
2. Remover componentes internos em `App` (`MainPages`).
3. Adicionar checklist de PR para “regra nova deve nascer em função pura testável”.
4. Criar ADR curto com “quando extrair use case”.

---

## 7) Exemplo prático (antes/depois)

### Exemplo A — Import GitHub

#### Antes (hook faz tudo)
```ts
// Hook mistura estado de UI + regra de conflito + commit
const detectedAll = detectConflicts(selectedRepos, allServices)
const bestConflictsForImport = pickBestConflicts(detectedAll)
await commitGithubImport({...})
```

#### Depois (hook orquestra, use case decide)
```ts
// application/use-cases/importGithubRepositories.ts
export function buildImportPlan(input: BuildImportPlanInput): ImportPlan { ... }
export async function executeImportPlan(plan: ImportPlan, deps: ImportDeps) { ... }

// ui/hook
const plan = buildImportPlan({ selectedRepos, allServices })
await executeImportPlan(plan, { addService, updateService })
```

**Ganho:** regra testável sem React.

---

### Exemplo B — Sync de Service

#### Antes
- `DetailPanel` conhece cliente GitHub, DefectDojo, parsing de metadata e merge.

#### Depois
- `DetailPanel` chama `syncServiceFromSources(serviceId)`.
- Use case aplica `mergeServiceDataPolicy` e retorna `Result`.

**Ganho:** UI limpa + lógica reutilizável.

---

## 8) Roadmap sugerido de melhoria

### Fase 0 — Base (1 semana)
- Definir convenção de camadas leve por feature.
- Criar diretórios `application/domain/ui` em `integrations` e `serviceRegistry`.

### Fase 1 — Regras críticas (2 semanas)
- Migrar GitHub import e Service sync para use cases.
- Testes unitários dos novos módulos puros.

### Fase 2 — Persistência (1-2 semanas)
- Modularizar fluxo de workspace FS em casos de uso.
- Garantir testes de cenários de merge/overwrite/disconnect.

### Fase 3 — Canvas ergonomics (2 semanas)
- Introduzir command handlers e reduzir contratos extensos de hooks.
- Medir regressão com testes de interação essenciais.

---

## O que manter, simplificar e quebrar

### Manter
- Forte modelagem de tipos e guards.
- Store central com slices e utilitários puros.
- Direção atual de separar canvas em hooks menores.

### Simplificar
- Hooks gigantes de integração e persistência.
- Contratos longos de keyboard/interação.

### Quebrar em partes menores
- `DetailPanel` (sync/merge fora da UI).
- `useGithubImport` (planejamento e execução fora do hook).
- `useFileSystemStorage` (fluxos transacionais em use cases).

### Provável abstração demais (evitar)
- Clean Architecture completa em toda UI de CRUD simples.

### Provável acoplamento demais (corrigir)
- Regras de negócio com side-effect dentro de componente/hook de tela.

---

## Referência externa consultada
- Vercel Labs — React Best Practices (Agent Skills):
  - https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
  - https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/AGENTS.md
