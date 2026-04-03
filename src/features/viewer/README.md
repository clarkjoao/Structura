# Viewer Feature

## Responsabilidade
Renderização de diagramas compartilhados em modo visualização (read-only).

## Estrutura
- `state/`: contexto de compartilhamento.
- `hooks/`: carregamento e adaptação de dados compartilhados.
- componentes em arquivos `Viewer*.tsx` e `Shared*.tsx`.
- `index.ts`: API pública.

## Limites
- Consumir via `@/features/viewer`.
- Regras de domínio permanecem em `@/features/diagram`.
