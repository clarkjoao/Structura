# Icons Feature

## Responsabilidade
Gerenciar biblioteca global de ícones e seleção por id.

## Estrutura
- `state/`: store e selectors da feature.
- `index.ts`: API pública.

## Limites
- Consumir via `@/features/icons`.
- Evitar imports internos como `@/features/icons/state/*` fora da feature.
