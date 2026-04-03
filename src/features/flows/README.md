# Flows Feature

## Responsabilidade
A feature `flows` concentra UI e estado de interação de flows (playback, recording, navegação de steps) consumindo o domínio persistido em `features/diagram`.

## Estrutura
- `components/`: painéis e componentes visuais de flow.
- `hooks/`: orquestração de playback/recording.
- `state/`: contexto/tipos/estado derivado de flow para UI.
- `domain/`: regras específicas de flow usadas pela UI (ex.: validação pré-play).
- `utils/`: helpers puros sem regra de negócio ampla.
- `index.ts`: API pública da feature.

## Regras de uso
- Consuma esta feature via `@/features/flows`.
- Não importar internals de `canvas/flow`.
- Persistência e entidades canônicas de flow continuam em `features/diagram` nesta fase.
