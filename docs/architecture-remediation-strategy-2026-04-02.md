# Estratégia de Correção — Architecture Review (2026-04-02)

## Objetivo
Transformar os achados da `architecture-review-2026-04-02.md` em um plano de execução **incremental**, com entregas pequenas, reversíveis e testáveis, começando pelos pontos de maior impacto em manutenção e evolução.

---

## Princípios de execução (para não travar o time)

1. **Sem big-bang rewrite**: cada PR deve ser pequeno e funcional por si só.
2. **Strangler pattern por fluxo**: extrair regras de negócio primeiro, sem quebrar UI.
3. **Feature flags de migração quando necessário**: manter fallback em fluxos críticos.
4. **Priorizar risco x impacto**: primeiro os fluxos com mais lógica e acoplamento.
5. **Regra nova nasce testável**: use cases e políticas devem ser funções puras sempre que possível.

---

## Escopo inicial (primeira onda de correções)

### Alta prioridade (primeiros PRs)
- AP-1: `useGithubImport` (separar regra de import/merge da camada React).
- AP-2: `DetailPanel` (tirar sync/merge/integrações de dentro do componente).
- AP-4: `useFileSystemStorage` (quebrar orquestração em casos de uso).
- AP-3: `components.slice` (reduzir dependência de i18n/catalog dentro do domínio).

### Média prioridade (segunda onda)
- MP-1: contratos do canvas (`useCanvasKeyboard`, `useCanvasInteraction`).
- MP-2: dashboard view-model.
- MP-3: limpeza i18n hardcoded.

---

## Plano em fases

## Fase 0 — Preparação (1-2 dias)

### Entregáveis
1. Criar convenção de pastas por feature:
   - `application/`, `domain/`, `ui/`, `infrastructure/`.
2. Definir template de use case:
   - `execute(input, deps): Result`.
3. Definir template de `Result` padronizado (`ok`, `error`, `code`).
4. Definir checklist de PR para refatoração arquitetural.

### Critério de pronto
- Time alinhado no padrão e com exemplos mínimos prontos.

---

## Fase 1 — GitHub Import (AP-1) (3-4 dias)

### Objetivo
Manter UX atual, mas remover regra de negócio do hook React.

### Passos
1. Criar `features/registry/application/use-cases/buildGithubImportPlan.ts` (puro).
2. Criar `features/registry/application/use-cases/executeGithubImportPlan.ts`.
3. Mover regras de prioridade/auto-resolução para `features/registry/domain/mergePolicies.ts`.
4. `useGithubImport` passa a:
   - coletar estado de tela,
   - chamar use cases,
   - atualizar loading/error.
5. Cobrir use cases com testes unitários focados em:
   - conflito github vs defectdojo,
   - auto-resolution,
   - import sem conflito.

### Critério de pronto
- Mesmo comportamento funcional na UI.
- Hook menor e com menos decisão de negócio.
- Testes dos use cases passando.

---

## Fase 2 — Service Sync no DetailPanel (AP-2) (3-4 dias)

### Objetivo
Componente de UI apenas para interação e render; sincronização vira caso de uso.

### Passos
1. Criar `syncServiceFromSources.ts` em `application/use-cases`.
2. Extrair merge para `domain/serviceMergePolicy.ts`.
3. Criar adapters:
   - `githubSyncAdapter`;
   - `defectDojoSyncAdapter`.
4. `DetailPanel` chama apenas `onSyncService(serviceId)` (hook de tela).
5. Adicionar testes:
   - priorização de campos,
   - merge de tags/technology/sources,
   - erro sem configuração de provider.

### Critério de pronto
- `DetailPanel` reduz complexidade e responsabilidades.
- Sync reutilizável em lote futuramente.

---

## Fase 3 — FileSystem Storage (AP-4) (4-5 dias)

### Objetivo
Reduzir risco operacional de merge/overwrite/disconnect.

### Passos
1. Extrair casos de uso:
   - `connectWorkspace`;
   - `mergeWorkspace`;
   - `overwriteWorkspace`;
   - `disconnectWorkspace`.
2. Criar orquestrador único com máquina de estado simples (`disconnected`, `connecting`, `connected`, `error`).
3. Hook mantém somente estado visual + chamadas do orquestrador.
4. Cobrir cenários críticos com testes de aplicação (mocks de adapter/store).

### Critério de pronto
- Fluxos críticos isolados e testáveis sem React.

---

## Fase 4 — Domínio desacoplado no components.slice (AP-3) (2-3 dias)

### Objetivo
Diminuir dependências de infra/apresentação no núcleo de domínio.

### Passos
1. Criar `ComponentFactory` (domínio) com dependências injetadas.
2. Mover defaults de texto/catálogo para providers em camada de composição.
3. Ajustar slice para delegar criação de componente/layout inicial à factory.
4. Garantir compatibilidade com histórico/undo.

### Critério de pronto
- Slice sem depender diretamente de i18n/catalog quando possível.

---

## Fase 5 — Canvas e Dashboard (média prioridade) (5-7 dias)

### Objetivo
Melhorar ergonomia de evolução e reduzir contratos gigantes.

### Passos
1. Canvas:
   - agrupar dependências de keyboard por contexto;
   - opcional: command handlers (`selection`, `clipboard`, `editing`).
2. Dashboard:
   - extrair `useDashboardViewModel`;
   - mover filtro/ordenação para funções puras.
3. i18n:
   - varredura de hardcoded strings + correção incremental.

### Critério de pronto
- Menos parâmetros em hooks críticos.
- Regras de lista/busca testáveis fora de componente.

---

## Plano de PRs (ordem sugerida)

1. `refactor(registry): extract github import plan/use-case`
2. `refactor(registry): extract service sync use-case from DetailPanel`
3. `refactor(persistence): split filesystem flows into use-cases`
4. `refactor(diagram): introduce component factory to reduce infra coupling`
5. `refactor(canvas): split keyboard interaction contracts`
6. `refactor(dashboard): introduce dashboard view-model`
7. `chore(i18n): remove remaining hardcoded visible strings`

---

## Métricas de sucesso

1. **Complexidade**: redução de tamanho/branches em hooks/componentes críticos.
2. **Testabilidade**: aumento de testes em `application/domain`.
3. **Tempo de mudança**: menor esforço para alterar regras de import/sync.
4. **Defeitos**: queda de regressão em fluxos de integração/persistência.

---

## Riscos e mitigação

1. **Risco**: regressão de comportamento em fluxo crítico.
   - **Mitigação**: PRs pequenos + testes de regressão por fluxo.
2. **Risco**: over-engineering.
   - **Mitigação**: aplicar arquitetura completa apenas em áreas com regra volátil.
3. **Risco**: desacoplamento parcial e inconsistente.
   - **Mitigação**: checklist arquitetural obrigatório por PR.

---

## O que vamos começar imediatamente (próximo passo)

### Sprint de arranque (próximos 2 dias)
1. Criar esqueleto de `application/domain` para `registry`.
2. Extrair `buildGithubImportPlan` + testes iniciais.
3. Adaptar `useGithubImport` para usar o novo plano sem mudar UI.

Com isso, iniciamos a correção já no ponto de maior retorno (AP-1), preservando comportamento e reduzindo acoplamento desde o primeiro PR.
