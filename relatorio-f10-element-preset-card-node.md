# Relatório — Fatia F10: `ElementPreset` / `CardNode`

Branch: `feat/element-registry-f10-element-preset-card-node`  
Base: `feat/element-registry-f9-catchall-removal`

## Mecanismo de storage (confirmado antes de migrar)

Não é `PERSIST_SCHEMA_VERSION` do diagrama. Três caminhos paralelos:

| Camada | Chave / campo antigo | Novo |
| --- | --- | --- |
| Zustand `persist` | `structura:custom-components` | `structura:element-presets` |
| `IStoragePort` | `custom_components` → `structura_custom_components` | `element_presets` |
| Manifest FS | `customComponentTemplates` | `elementPresets` |

Migração: ler antigo → gravar novo (Zustand remove a chave legada; IStoragePort reescreve na nova; FS lê via `readElementPresetsField` e grava só `elementPresets`).

## Contagem real de importadores (não o número do mapeamento)

Após F4/F5b (`AwsIcon` removido, `CloudIcon` unificado):

- **`import CardNode from …/CardNode`:** 4 arquivos (C4 + AWS + GCP + Azure families)
- **Paths `nodes/CardNode` / TypeConfig / Handles:** ~18 arquivos `src/` no total
- **Plugin LeanIX:** só comentário em `export-core/constants.ts` (sincronizado via `sync-shared`)

Nenhuma classe CSS `custom-node` / `.CustomNode` existia.

## Renames

### `CustomComponentTemplate` → `ElementPreset`

- Feature `custom-components/` → `element-presets/`
- Store `useElementPresetStore` (`presets` / `addPreset` / …)
- Hook `useElementPresetLibrary`
- UI i18n: `elementPresets.myPresets` / `saveAsPreset` (en + pt-BR)

### `CustomNode` → `CardNode`

- Pasta `nodes/CustomNode/` → `nodes/CardNode/`
- Families C4/GCP/Azure/AWS apontam `component: CardNode`
- i18n `customNode.*` → `cardNode.*`

## Gates

| Gate | Resultado |
| --- | --- |
| typecheck | OK |
| Vitest (presets, migration, families, elements, node-types) | OK |
| `sync-shared.mjs --check` | OK após sync do comentário |

## Fora de escopo

F7/F8 (K8s/oss), deploy F6b.
