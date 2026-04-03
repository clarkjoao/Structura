# Diagram Feature

## Responsabilidade
Domínio central do workspace: entidades de diagrama, store persistida e regras de edição/persistência.

## Estrutura
- `model/`: tipos e contratos de domínio.
- `store/`: estado global (Zustand), slices e selectors.
- `utils/`: regras e operações puras do domínio.
- `hooks/`: hooks específicos de suporte.
- `index.ts`: API pública consolidada.

## Limites
- Outras features devem consumir via `@/features/diagram`.
- UI específica (canvas/viewer/flows) não deve definir tipos canônicos do domínio.
