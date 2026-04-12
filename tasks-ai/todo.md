# UX: Save, Undo por Diagrama e Confirmações

- [x] Inspecionar header do canvas/dashboard, histórico undo/redo e pontos de deleção
- [x] Prompt 1: adicionar indicador de "Salvando..." / "Salvo" e integrá-lo ao header
- [x] Prompt 2: corrigir undo/redo para operar apenas no diagrama ativo e limpar histórico ao deletar diagrama
- [x] Prompt 3: substituir confirmações de deleção por `AlertDialog` em jornadas e diagramas
- [x] Atualizar i18n e validar com lint focado/build

## Review

- O autosave do Zustand agora expõe estado de UI dedicado, com transições explícitas para `pending`, `saved` e `error`, e o header do editor mostra esse feedback de forma discreta.
- Undo/redo passou a procurar snapshots apenas do `activeDiagramId`, evitando mutações silenciosas em outros diagramas quando o histórico está intercalado.
- A deleção de jornadas e diagramas saiu de `window.confirm` e passou para `AlertDialog`, cobrindo grid e lista do dashboard com contexto suficiente para evitar remoções acidentais.
- Verificação executada: `npx eslint src/features/diagram/store/persist.config.ts src/features/diagram/store/saveStatus.store.ts src/features/diagram/store/slices/history.slice.ts src/features/diagram/store/slices/diagram.slice.ts src/features/canvas/components/SaveStatusIndicator.tsx src/features/journeys/components/JourneyCard.tsx src/pages/dashboard/DiagramCard.tsx src/pages/dashboard/index.tsx src/pages/modelExplorer/ModelExplorerContent.tsx`
- Verificação executada: `npm run build`
