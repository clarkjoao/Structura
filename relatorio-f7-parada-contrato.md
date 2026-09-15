# Parada F7 — o contrato ainda não passa no teste “só 4 pontos”

Branch criada: `feat/element-registry-f7-kubernetes-family` (vazia de código de implementação).  
Base: `feat/element-registry-f10-element-preset-card-node`.

**Nenhum arquivo de implementação Kubernetes foi escrito.** Esta fatia pediu
explicitamente: se um quinto arquivo for necessário para Kubernetes funcionar de
ponta a ponta, **parar e reportar** — isso é a métrica, não um detalhe.

## O que o plano prometeu (4 pontos)

Per `proposta-arquitetura-elementos.md` §4.1 / `plano-migracao-elementos.md` F7:

1. `elements/families/k8s/k8s.family.ts`
2. Registro em `families/index.ts` (hoje: `elements/bootstrap.ts` — o índice proposto
   **não existe**)
3. Tokens de accent (`index.css` + `tailwind.config.ts`)
4. i18n `elements.k8s.*` nos dois locales

## Achado: o critério “só 4 pontos” já falhou no estado atual do código

GCP/Azure/AWS **não** entraram em 4 arquivos. O registro de uma família nova ainda
exige camadas que o contrato prometeu absorver e ainda não absorveu. Para Kubernetes
aparecer em **paleta, canvas, painel, export e catálogo LLM**, estes arquivos
adicionais seriam necessários (além dos 4):

### Bloqueadores duros (contrato incompleto)

| Área | Arquivos | Por quê |
| --- | --- | --- |
| **Type system** | `element.types.ts` (`ElementFamilyId`, `RegisteredElementTypeId`), `cloud-family.types.ts` (`CloudFamilyId` **exclui k8s de propósito**), `component.types.ts`, `component.guards.ts`, `single-owner.invariant.test.ts` | Sem isto `CloudFamilyDefinition` com `id: "k8s"` **não compila**. |
| **Cloud provider stack** | `cloud/providers/k8s/{catalog,icon-resolver,provider}.ts` + `cloud/bootstrap.ts` | Paleta GCP/Azure, `CloudIcon`, `isCloudComponent` e o inspector (`ComponentPanel`) leem `cloudRegistry`, não só o element registry. |
| **Paleta (alto risco)** | `canvas/enums.ts`, `buildCategoryNav.ts`, `ElementPickerModal.tsx`, `ElementPickerSearchResults.tsx`, `QuickInsertPopover.tsx` (+ possivelmente `CloudIcon` fallback) | Tabs/busca **hardcodam** Aws/Gcp/Azure. `CloudBrowseView` é genérico, mas **ninguém itera** `cloudRegistry.allProviders()` para montar nav. Sem estes arquivos, K8s não aparece na paleta. |
| **LLM catalog** | `llm/component-catalog.ts` | Derivação por família é genérica (`cloudFamilyRegisteredTypes`), mas `allComponentTypes()` / `buildComponentTypeCatalog()` **listam aws/gcp/azure à mão**. |
| **Export draw.io** | Se usar `mxgraph.kubernetes.*`: `export-core/{model,styles,cell-builders,constants}.ts` (+ sync LeanIX). Se usar piso `image`/`passthrough` como GCP/Azure: **só** o `toExportNode` dentro do family file — **sem** quinto arquivo de export-core. | `mxgraph.kubernetes` **não aparece** neste repo nem em `node_modules`; cobertura real não é verificável aqui. |

### O que **já** funciona sem quinto arquivo (depois do registro)

- **Canvas render** via `CardNode` + descriptors no element registry
- **Inspector** cloud dropdowns (`ComponentPanel` já usa `allProviders()`)
- **Criação** via `isRegisteredElementType` → `descriptor.model.createComponent`

## Fonte de ícones — ponto de parada (não decidido)

| Opção | Prós | Contras |
| --- | --- | --- |
| **A. npm `kubernetes-icons`** (wrapper não-oficial dos ícones da community) | Mesmo padrão operacional de `gcp-icons` (`import.meta.glob` de SVG) | Pacote ISC com ~4 downloads/semana; arte oficial é Apache-2.0 **ou** CC-BY-4.0 + trademark LF — a licença do wrapper ≠ licença da arte. Manutenção duvidosa. |
| **B. Vendorizar SVGs de `kubernetes/community/icons`** | Fonte oficial; licença documentada (Apache-2.0 / CC-BY-4.0); padrão GCP local | Exige confirmar licença/atribuição no repo **antes** de commitar binários; trademark do logo K8s. |
| **C. Pacote estilo react-icons aws/azure** | — | **Não há** equivalente óbvio mantido no npm no padrão `aws-react-icons` / `azure-react-icons`. |

**Recomendação (não executada):** Opção B (SVGs oficiais unlabeled sob Apache-2.0),
espelhando GCP — **só depois** de confirmação explícita de licença/atribuição.

## Export draw.io — cobertura

- No código atual: **zero** referências a `mxgraph.kubernetes.*`.
- Caminhos possíveis sem inventar kind novo:
  1. **Piso `image`** (GCP) se houver SVG embutível
  2. **Piso `passthrough`** (Azure) — caixa rotulada
  3. **Kind novo `k8s`** + mapa tipo `AWS_RESICON` — exige export-core (quinto+ arquivo) e sync-shared

Sem inventário draw.io desktop neste ambiente, a cobertura real dos shapes
`mxgraph.kubernetes.*` **não foi medida**. Kind nativo = outro desvio do “só 4 pontos”.

## O que isto diz sobre o contrato (a métrica da fatia)

A arquitetura prometeu que família nova = 4 pontos. Na prática, após F4–F10:

1. **Paleta ainda é lista de provedores**, não view sobre o registry/cloudRegistry.
2. **LLM catalog wiring ainda é lista de famílias**, não loop sobre `allElements()`.
3. **`CloudFamilyId` ainda fecha o conjunto** aws|gcp|azure — K8s foi deixado de fora
   de propósito até “provar a forma”.
4. **Dois bootstraps** (cloud + elements) em vez de um `families/index.ts`.

F7, como escrita, **não pode** ser “só registrar a família” sem ou (a) aceitar tocar N
arquivos de consumidores, ou (b) primeiro fechar o contrato (paleta/LLM/types
derivados) e só então adicionar o catálogo K8s.

## Como prosseguir (aguardando decisão)

1. **Fechar o contrato primeiro** (fatia pré-F7): paleta + LLM + `CloudFamilyId`
   derivados do registry — aí F7 volta a caber em ~4 pontos de dados.
2. **Implementar K8s aceitando o desvio** — lista explícita de arquivos extras no
   relatório, export no piso `image`/`passthrough` (sem kind novo), ícones só após
   confirmação de licença (opção B).
3. **Outra ordem** que você preferir.

Não houve implementação nem vendorização de assets.
