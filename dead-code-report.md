# Dead Code Sweep Report

Executado em 2026-07-21. Classificação baseada em grep verification.

---

## Removidos (Balde A) ✅

| ID | Item | Ação |
|----|------|------|
| **DC1** | `src/features/diagram-template/` (4 subpastas vazias) | Deletado. Zero arquivos, zero refs. |
| **DC2** | `src/pages/Index.tsx` + `src/components/LandingPage.tsx` | Deletados. App.tsx redireciona `/` → `/workspace`; páginas sem consumidores. |
| **DC3** | `src/components/ui/separator.tsx` | Deletado. Não exportado no barrel, zero imports. |
| **DC4** | `EDGE_SEGMENT_HIGHLIGHT_STROKE_OPACITY` em `canvas.constants.ts` | Removido do arquivo. Zero consumidores (confirmado grep). |
| **DC14** | `PERSIST_SCHEMA_VERSION`, `CURRENT_SCHEMA_VERSION`, `partializeState`, `PersistedDiagramStoreSlice` no barrel de `diagram` | Removidos do barrel. Zero consumidores externos ao módulo. |

---

## Barrels Estreitados (Balde B) — Mantido, re-export removido ⚠️

> Estas funções/componentes existem e são usados internamente. A correção é remover o re-export do barrel público, não apagar a implementação.

| ID | Item | Ação Proposta |
|----|------|---------------|
| **DC5** | `useLastEdgeStyle.ts` (`getLastEdgeStyle`, `saveLastEdgeStyle`) | **Mantido.** Usado em `ConnectionPanel.tsx`, `QuickInsertPopover.tsx`, `useCanvasEventHandlers.ts`. Apenas remover do barrel público (se exportado). |
| **DC6** | `useWalkthroughGlobalPlayer` | **Mantido.** Usado em `WalkthroughEditorPage.tsx`. |
| **DC8** | `flow-traversal.ts`, `flow-mermaid.ts`, `flow-migration.ts`, `flow-repair.ts`, `flow-duplicate.ts`, `fit-group-to-children.ts`, `api-group-size.ts`, `handle-order.ts`, `template-sharing.ts`, `component-lock.ts` | **Mantidos.** Usados internamente. Remover re-exports do barrel de `diagram/utils`. |
| **DC9** | `llm/errors.ts`, `llm/tools.ts`, `llm/patch-parser.ts`, `llm/suggestions.ts` | **Mantidos.** Usados internamente. Remover re-exports se houver barrel público de llm. |
| **DC10** | `parseMermaidFlowchart`, `parseMermaidSequence` | **Mantidos.** Usados em `FlowPanel.tsx`, `MermaidImportDialog.tsx`. Remover do barrel público se exportado. |
| **DC11** | `component-lock.ts` (`isAncestorLocked`) | **Mantido.** Usado em `useCanvasNodes.ts`, `useNodeDragParenting.ts`, stress tests. Remover do barrel público. |
| **DC12** | `shared-import.ts` (`formatDiagramImportCalendarDate`, `resolveUniqueDiagramId`) | **Mantido.** Usado em `SharedDiagramView.tsx`. Remover do barrel público. |
| **DC13** | `connection-defaults.ts` (`getIntentDefault`, `DIRECTION_MARKERS`, `EffectiveConnectionStyle`) | **Mantido.** `getEffectiveConnectionStyle` usado em `buildEdges.ts`, `to-export-model.ts`. Remover do barrel público. |
| **DC17** | `resolveCanvasSnapshot`, `resolveCompareSnapshot` de `scene.utils.ts` | **Mantido.** Usado internamente em `snapshot-cache.ts`. Remover do barrel público. |
| **DC18** | `getNextSteps`, `walkFlow` de `flow-traversal.ts` | **Mantido.** Funções exportadas mas grep não encontrou uso externo — verificar necessidade. |
| **DC29** | `MAX_HISTORY_STEPS`, `HISTORY_COALESCE_MS`, `UNDO_REDO_COOLDOWN_MS` em `canvas.constants.ts` | **Removidos.** Confirmado: zero consumidores internos. |

---

## Aguardando Decisão (Balde C) 📋

| ID | Item | Problema | Ação Proposta |
|----|------|----------|---------------|
| **DC15** | `isCloudComponent` em `component.guards.ts` | É candidato a uso quando S11 (`CloudComponent` union) for aplicado | **Não remover.** Manter para uso futuro. |
| **DC19** | `.env.example` — `VITE_DISABLE_SEEDS=false` | Default ok; a checagem usa `=== "true"` (string) | **OK — só nota.** Nenhuma ação necessária. |
| **DC20** | `server/dist/` commitado | Artefato de build, não source code. `dist/` está no `.gitignore` mas foi commitado | **Limpar:** `git rm -r --cached server/dist` + rebuild. Confirmar com Mestre se há necessidade de re-build. |
| **DC22** | `--font-serif` em `index.css` | Declarado mas sem uso em componentes | **Investigar** se algum componente usa implicitamente. Se não, remover do CSS. |
| **DC23** | `walkthroughEditorCanvas.utils.ts` | Arquivo não existe mais (provavelmente já foi refatorado) | **Verificar** se era para ser algo que existe em outro lugar. |
| **DC24** | `pages/walkthroughs/` com apenas 2 arquivos | Estrutura simples, não é problema real | **Nenhuma ação.** Mantém convenção de pages/. |
| **DC25** | Testes em `selection-actions/index.ts` | Testes estão na pasta correta | **Nenhuma ação.** |
| **DC26** | `ElementPanel/components/` e `sections/` | Estrutura com subpastas | **Nenhuma ação.** Mantém organização. |
| **DC27** | `viewport-utils.ts` no root de canvas | Poderia mover para `canvas/utils/` | **Opcional.** Melhoria de organização, não correção. |
| **DC28** | `canvas/enums.ts` mistura `ElementCategory`, `HandleSide`, `SwimlaneOrientation` | Inconsistência de nomenclatura | **Opcional.** Separar enums se houver vontade. |
| **DC30** | `stress-canvas-pipeline.test.ts`, `stress-panels.test.ts` | Tests com timeout 90000 | **Verificar** se rodam no CI. |

---

## Divergências do Audit (grep venceu)

- **DC14**: O audit dizia que `PERSIST_SCHEMA_VERSION` etc estavam exportados mas sem consumidores. Confirmado: removidos do barrel. ✅
- **DC5, DC6**: Audit dizia "zero consumidores", mas grep encontrou uso interno. Mantidos. ⚠️
- **DC10**: Audit dizia "zero consumidores externos", mas há uso em `FlowPanel.tsx` e `MermaidImportDialog.tsx`. Mantidos. ⚠️
- **DC23**: Audit dizia que o arquivo existia, mas não existe mais. ✅

---

## Nota sobre DC7, DC21

- **DC7** (`Journey*` aliases): Já removido no commit anterior (`refactor/remove-journey-aliases`).
- **DC21** (`useRegistryActions`): Já removido no mesmo commit.

---

## Resumo

| Categoria | Count |
|-----------|-------|
| Removidos (Balde A) | 5 |
| Barrels estreitados (Balde B) | ~12 items para estreitar barrel |
| Aguardando decisão (Balde C) | 11 items |
| Já feitos | 2 (DC7, DC21) |
