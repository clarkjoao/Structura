# Segunda auditoria independente — verificação das correções

**Data:** 2026-09-15  
**Alvo:** `fix/k8s-oss-cloud-service-id-typing` @ `ef5d770`  
**Entrada:** [auditoria-independente-element-registry.md](auditoria-independente-element-registry.md),
[correcao-achados-auditoria.md](correcao-achados-auditoria.md)  
**Método:** leitura do código + execução própria de gates/probes (não confiança no
relatório de correção). Probes reversíveis; working tree limpa ao final.  
**Escopo desta sessão:** auditoria e relatório — nenhum código de produto alterado
(exceto probes revertidos).

### Confirmação de branch

`fix/k8s-oss-cloud-service-id-typing` é o tip da sequência:

`feat/element-registry` (`fdaa15b`) → auditoria (`716bfe3`) → correção dos 7 itens
(`808b8a0`…`06c2abd`) → tipagem k8s/oss + remoção do fallback `serviceId`
(`2a6ab8f`…`ef5d770`). Contém F0–F9 e as duas rodadas pós-auditoria.

---

## 1. Os 7 itens originais

### Item 1 — Guard técnico F6b (`cloudServiceId`)

**Veredicto: verificado correto**

Evidência executada nesta sessão:

| Comando | Resultado |
| --- | --- |
| `npm run build` | **exit 1** — mensagem `[F6b release gate]` apontando ADR-0010 e `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true` |
| `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true npm run build` | **exit 0** — bundle completo |

Código:

- Único produtor: `cloudServiceIdWrite()` / `cloudServiceIdClearingPatch()` em
  `src/features/diagram/model/cloud-service-id.ts`.
- Gate de build: `cloudServiceIdReleaseGate` em `vite.config.ts` (`apply: "build"`).
- Teste de varredura: `cloud-service-id.write-gate.test.ts`.

**Probe (revertido):** acrescentei
`export const __auditProbe = { cloudServiceId: "probe" };` em
`sanitize-component-type.ts`. O teste falhou nomeando exatamente essa linha; após
reverter, os 4 testes do arquivo voltaram a passar. O gate de escrita **pega site
novo**.

Observação (não é regressão): as funções de escrita **não** leem a flag em runtime —
o corte é o bundle de produção. Isso bate com o relatório de correção e com o ADR.

---

### Item 2 — Gate F8b (mesmo turno)

**Veredicto: verificado correto**

- `npx vitest run …/add-node-validation.test.ts` — passou.
- Caso aceite: *"applies a valid add_node unrelated to the search in the same patch"*
  — `search_elements("redis")` + `add_node(aws-compute, lambda)` → **aplica**.
- Pares inventados (`not-a-service`, `aws-invented`, `oss-datastore`+`lambda`) →
  **rejeitados** via `validateAddNodeAgainstRegistry`.
- O gate por `sawSearch` / hits da busca **não** restringe mais `ADD_NODE`.
- Prompt em `component-catalog.ts` não promete mais skip por “unmatched” à busca;
  fala em registro.

**Residuo documentado (igual ao relatório, fora do aceite):** categoria cloud sem
`serviceId` continua rejeitada pelo registry gate; paleta/`attachService` ainda
permitem. Não é o falso positivo que a auditoria bloqueou.

---

### Item 3 — Campos mortos + presets

**Veredicto: verificado correto** (com a nuance 3b já anunciada)

- `ALLOWED_COMPONENT_PATCH_KEYS` literal **sumiu**; `patchableKeysForType()` deriva de
  `BASE_PATCHABLE_KEYS` ∪ `descriptor.model.patchableKeys`.
- `element-preset.patchable-keys.test.ts` — passou; cobre `svgContent`, `flowShape` /
  `nodeColor`, `panelColorDark`, `customColor`, linked\*, e round-trip genérico sobre
  `allElements()` (inclui `rawContent` do `unknown` sem caso nomeado — suficiente para
  não regressar em silêncio).
- Removidos do contrato: `defaultNameKey`, `drawio.minSize`, `sections`.
- `descriptionKey` ligado em `searchElements`; OSS popula chaves por serviço.

**3b (esperado, não implementado):** `element-presets` ainda importa `aws.catalog` e
`panels` no preview card. A fronteira completa continua aberta — como o relatório
disse. Isso **não** reabre a perda de dado de preset.

---

### Item 4 — F5c / IR

**Veredicto: verificado correto**

- Função renomeada: `irAwsCategoryIdsFromCatalog()` (lê `AWS_CATEGORIES`).
- Teste tautológico *"getIrSemanticTypes is live"* **ausente**.
- Bloco atual compara catálogo estático ↔ `allElements().filter(family === "aws")`.
- ADR-0010 e `docs/architecture/element-registry.md` registram o revert como decisão
  em vigor.

**Probe (revertido):** categoria `aws-fictional` acrescentada só em `awsFamily.categories`
(fora de `AWS_CATEGORIES`). O teste falhou com
`registered AWS categories missing from the IR: aws-fictional` e na asserção de
paridade. Após reverter, 10/10 verdes.

Limite honesto (já no comentário do teste): unit test não pega snapshot vazio no
chunk lazy do LLM; o guard real continua sendo Cypress
(`ir-generation-smoke.cy.ts`).

---

### Item 5 — Enumerações de família

**Veredicto: verificado correto** no escopo dos sites da primeira auditoria (+ os dois
extras que a correção achou); **residuais menores restam** (ver § residual abaixo).

- `structural-family-contract.test.ts` — passou (família estrutural fictícia: list /
  search / `isValidNodeType` / aba / export / prefix recovery).
- Sites fechados: `listElementFamilies` / `searchElements` via `nonCatalogFamilyIds()`;
  `recoverCloudCategoryPrefix` via `hasElement(\`${prefix}-general\`)`; nav do picker
  deriva abas; `allComponentTypes` / `isValidNodeType` não filtrando só structural/c4.

**Busca ativa por uma “6ª” (e além):**

| Residual | Onde | Classe |
| --- | --- | --- |
| Helpers de seção do prompt | `registeredElementTypes()` / `c4RegisteredTypes()` ainda nomeiam `"structural"` / `"c4"`; loop com `continue` para esses ids | Cosmético de heading — famílias novas ainda entram pelo loop `nonCatalogFamilyIds()` |
| Fork AWS → panel | `ElementPickerModal` / `QuickInsertPopover` + `AWS_SERVICE_TO_PANEL_KIND` | Débito do Item 6, não enumeração de todas as famílias |
| Ícone na busca | `CanvasSearch.tsx`: tudo que não é structural/c4 → ícone Cloud | Heurística UI |
| Accent de preset | `resolve-template-accent-color.ts`: só `startsWith("aws-")` laranja; resto azul | Visual de preset |
| `FALLBACK_BY_FAMILY` | `CloudIcon.tsx` aws/gcp/azure | Débito 4 — praticamente morto pós-boot |

Nenhuma dessas reabre o buraco “família estrutural invisível ao LLM / rejeitada em
`add_node` / sem aba”. O teste de aceite estrutural fecha o contrato que a auditoria
pediu.

---

### Item 6 — Contrato “só cards” (só avaliação)

**Veredicto: verificado correto** (nada implementado; avaliação sólida)

- `build-cloud-family-descriptors.ts` ainda fixa `role: "card"`, `canBeParent: false`.
- `k8s.catalog.ts` aponta para `correcao-achados-auditoria.md` item 6 — não para o
  relatório F7 deletado.
- Nenhuma API `creates` / `role: "container"` foi adicionada.

**Concordo com (A) antes de (B):** generalizar o remap de paleta (o que o AWS já faz
fora do registry) remove forks sem migração de dado. (B) tipa containers de verdade e
muda o que uma VPC *é* — destino distinto, não o próximo degrau automático de (A).
Se (B) for requisito próximo, pular (A) evita campo descartável; hoje não há esse
requisito no código.

---

### Item 7 — `AGENTS.md`

**Veredicto: verificado correto** para o papel do arquivo

Confirmado no tip:

- Mapa inclui `features/elements/` e `element-presets/` (não `custom-components/`).
- Regra: tipos built-in via element registry / ADR-0010; `NodeTypeDescriptor` só para
  plugins.
- `cloudServiceId` + flag de build F6b documentados.
- Sharp edge do chunk LLM / não snapshotar `allElements()` presente.

**Lacunas menores (não reabrem o achado):**

- Não nomeia `K8sComponent` / `OssComponent` (a regra de `cloudServiceId` já cobre o
  uso).
- `.cursor/rules/structure-architecture.mdc` ainda manda registrar via
  `NodeTypeDescriptor` — **fora** de `AGENTS.md`, mas ainda pode desorientar agentes
  Cursor. Higiene, não bloqueador da sequência.

---

## 2. Achados colaterais 2 e 3

### Colateral 2 — `K8sComponent` / `OssComponent`

**Veredicto: verificado correto**

- Tipos na união `Component` (+ patches / `ComponentType` / ids de categoria).
- `attachService` em `k8s.family.ts` / `oss.family.ts`: retorna
  `{ ...base, type, ...cloudServiceIdWrite(serviceId) }` — **sem** `as Component` /
  `as unknown`.

### Colateral 3 — vazamento `serviceId` → LLM

**Veredicto: verificado correto**

- `resolveCloudServiceId`: só `cloudServiceId ?? awsService ?? gcpService ?? azureService`.
  `serviceId` de negócio **não** entra na cadeia (permanece no tipo só por
  assignability — documentado).
- `serializer.test.ts` — *"does not serialize business-catalog serviceId as awsService
  (svc-pay leak)"* passou: C4/`k8s` com só `serviceId: "svc-pay"` **não** emitem
  `awsService="svc-pay"`; AWS com `cloudServiceId: "lambda"` emite.
- Demais callers de `resolveCloudServiceId` não reintroduzem o fallback.

Cenário motivador: componente com `serviceId` de catálogo de negócio e sem
`cloudServiceId` **não** aparece ao LLM como serviço de nuvem.

### Decisão do guard Item 1 vs k8s/oss

**Concordo com aplicar uniformemente.** O build gate é binário; k8s/oss já escrevem
pelo mesmo `cloudServiceIdWrite()`. “Isentar” só na prosa mentiria sobre o artefato.
Isentar de verdade exigiria redesenho (runtime/por-família) — fora do que esta fatia
precisava.

---

## 3. Débito remanescente (colaterais 1, 4, 5, 6, 7 do relatório)

Numeração do relatório de correção:

| # | Achado | Veredicto | Justificativa |
| --- | --- | --- | --- |
| 1 | `as unknown as ComponentPatch` em `ComponentPanel.tsx` | **Seguro deixar** | Blame: cast em `5c5e2b7` (pré-sequência de tipagem); payload já passa por `cloudServiceIdClearingPatch`. É atrito de `ComponentPatch` como interseção, não bug de runtime escondido. |
| 4 | `*.provider.ts` + `cloud/bootstrap.ts` mortos | **Seguro deixar** | Zero importadores; sem `import.meta.glob` carregando `*.provider.ts`. Bootstrap é `export {}` stub. |
| 5 | Famílias hardcoded | **Seguro deixar** (para merge desta sequência) | Recovery/nav/LLM validity fechados. Residuais listados no Item 5 são UI/prompt/fork AWS — não o buraco original. |
| 6 | `FALLBACK_BY_FAMILY` | **Seguro deixar** | Só quando não há resolver; pós-boot as 5 famílias têm resolver + `Fallback`. |
| 7a | Dois `CloudIcon` (`familyId` vs `providerId`) | **Seguro deixar** | Alias 1:1 no canvas; sem bug de resolução encontrado — só vocabulário duplo. |
| 7b | Seed `urlshort-example.ts` com display names em `cloudServiceId` | **Seguro deixar** | Nenhum teste asserta esses valores; ícones do seed falham lookup — feio, não CI. |

Nada deste débito exige outra rodada **antes** da decisão de merge dos achados da
auditoria. Vale limpar depois; não reabre bloqueadores.

---

## 4. Gates de lint / format

Reproduzido em worktree detachada de **`feat/element-registry` @ `fdaa15b`** (a base
que o relatório de correção citou) vs HEAD desta branch.

### Lint — pré-existente, confirmado

Ambos: **2 errors, 33 warnings**, mesmos arquivos:

1. `EdgeLabelPortal.test.tsx:99` — reassign fora do componente/hook  
2. `JsonViewerPanel.tsx:59` — `activeDiagram` unused  

O relatório de correção acertou: **não foram introduzidos pelos 7 itens**.

### Format — parcialmente pré-existente

| Base (`feat/element-registry`) | HEAD (`fix/k8s-oss-…`) |
| --- | --- |
| 10 arquivos | 9 arquivos |

Herdados ainda vermelhos (canvas hooks / TabBar / JsonViewerPanel / README).  
A tip **removeu** três da base (`element-picker/utils.ts`, `k8s/ICONS_LICENSE.md`,
`SuggestionCard.tsx`) e **acrescentou** dois desta fatia colateral:

- `src/features/diagram/model/component.guards.ts`
- `src/features/llm/serializer.test.ts`

Conclusão: a classificação “format já estava vermelho” é **verdadeira para a classe
de falha e para a maioria dos arquivos**; não é verdade que *todo* offender do tip
seja herdado. Os dois novos são higiene Prettier trivial — **não** reabrem achados
funcionais da auditoria. Se o CI do merge exigir `format:check` verde, esses dois
(e os herdados) ainda precisam de uma passagem — independente da correção dos 7.

---

## 5. Veredito final

**Esta sequência está pronta para a decisão de merge**, ficando como pendência
conhecida e deliberada a **janela de deploy de F6b** (`VITE_ENABLE_CLOUD_SERVICE_ID_WRITE`
continua `false` por padrão; `npm run build` recusa o artefato até alguém ligar a
flag).

Os 7 itens da primeira auditoria foram corrigidos de verdade (Item 6 só avaliação,
como pedido). Os colaterais 2 e 3 estão corrigidos de verdade — incluindo o cenário
svc-pay no serializer. O débito remanescente (1, 4–7) é seguro deixar para depois.

Não há achado novo que exija outra rodada de correção **antes** dessa decisão. O que
resta é produto/processo (quando ligar a flag) e higiene (lint/format herdados + dois
arquivos Prettier da tip), não lacuna das correções auditadas.
