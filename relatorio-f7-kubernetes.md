# Relatório F7 — Kubernetes como família nova (retomada)

Branch: `feat/element-registry-f7-kubernetes-family`  
Base: `feat/element-registry-contract-close-families`

## Veredito

**Kubernetes funciona de ponta a ponta via `registerCloudFamily`.** Paleta, canvas
(CardNode), inspector (`cloudRegistry` derivado), export (piso `image`) e catálogo
LLM aparecem **sem** editar enums, `ComponentType`, paleta hardcoded, LLM lists ou
`export-core`.

Isso confirma o fechamento de contrato: o acoplamento de *consumidores* é zero.
O que ainda se toca são arquivos de **conteúdo da família** (catálogo, ícones,
i18n, accents) + a linha de registro — o mesmo espírito do plano original F7,
agora sem os cinco bloqueadores da primeira tentativa.

## Contagem de arquivos tocados

### Consumidores / contrato (esperado do teste fictício: 0)

| Arquivo | Status |
| --- | --- |
| `CloudFamilyId` / `ComponentType` / enums de paleta | **não tocados** |
| `llm/component-catalog.ts` | **não tocado** |
| `export-core/*` | **não tocado** |
| `cloud/bootstrap.ts` / `cloud/providers/k8s/*` | **não criados** |

### Registro (esperado: 1)

| Arquivo | Mudança |
| --- | --- |
| `elements/bootstrap.ts` | `k8sFamily` no array de `registerCloudFamily` |

### Conteúdo da família

| Arquivo | Papel |
| --- | --- |
| `families/k8s/k8s.catalog.ts` | categorias + serviços |
| `families/k8s/k8s.family.ts` | `CloudFamilyDefinition` |
| `families/k8s/k8s.icon-resolver.ts` | `IconResolver` (`import.meta.glob`) |
| `families/k8s/k8s.export-icons.ts` | data URI para export `image` |
| `families/k8s/k8s.family.test.ts` | aceite |
| `families/k8s/ICONS_LICENSE.md` | licença Apache-2.0 elected |
| `families/k8s/icons/*.svg` (14) | arte oficial unlabeled |

### Apresentação (plano F7 original pontos 3–4; o teste fictício *reusou* keys)

| Arquivo | Papel |
| --- | --- |
| `locales/en.json` + `pt-BR.json` | `elements.k8s.*` + `canvasToolbar.kubernetesServices` (obrigatório: `registerElement` valida locales) |
| `index.css` + `tailwind.config.ts` | tokens `--k8s-*` / `border-l-k8s-*` |

**Comparação com o teste fictício:** o fictício coube em “definição + register”
porque reusou keys i18n existentes e `accent: neutral`. Uma família real **precisa**
de i18n (gate do registry) e, para paridade visual com GCP/Azure, de accents.
Nenhum desses é acoplamento de consumidor — são dados da família.

## Ícones — decisão e licença

- **Rejeitado:** npm `kubernetes-icons` (ISC no wrapper ≠ arte; ~4 downloads/semana).
- **Adotado:** SVGs unlabeled de
  `https://github.com/kubernetes/community/tree/main/icons/svg/resources/unlabeled`
- **Licença do set:** escolha Apache-2.0 **ou** CC-BY-4.0. Structura elege
  **Apache-2.0** (`ICONS_LICENSE.md`). Trademark do logo K8s: Linux Foundation
  Trademark Usage Guidelines.
- Sem NOTICE global no repo; o aviso vive junto aos assets (mesmo padrão de
  provenance local que o pacote GCP resolve via npm).

## Catálogo

| Categoria | Recursos |
| --- | --- |
| Workloads | Deployment, StatefulSet, DaemonSet, Job, CronJob, Pod |
| Networking | Service, Ingress, NetworkPolicy |
| Storage | PersistentVolume, PersistentVolumeClaim, StorageClass |
| Config | ConfigMap, Secret |

**Namespace / Cluster:** adiados. São agrupadores (como `panel` / PANEL_KINDS),
não serviços-card. Fica para fatia futura se quisermos painéis K8s — documentado
aqui, não implementado.

## Export draw.io

- `mxgraph.kubernetes.*`: **zero** referências no repo / node_modules verificáveis.
- Cobertura: **piso `image`** com SVG embutido (como GCP) para os 14 recursos;
  **passthrough** se o SVG faltar.
- Nenhum kind nativo novo em export-core.

## Performance

Continuidade da série `cloud-family-perf.baseline.test.ts` (adapters cached no
register). K8s adiciona 1 provider / 4 categorias ao registry — mesmo caminho O(1)
por `forId` / O(n families) em `allProviders`.

## Gates

- `npm run typecheck` — ok
- testes `families/k8s` + contract + single-owner — ok
- `npm run plugins:sync-check` — ok

## Fora de escopo (respeitado)

Import draw.io K8s, F8 oss/Redis/Kafka, tools LLM, deploy F6b, PR.
