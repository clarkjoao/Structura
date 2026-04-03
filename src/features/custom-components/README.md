# Custom Components Feature

## Responsabilidade
Gerenciar biblioteca de templates/componentes customizados reutilizáveis.

## Estrutura
- `components/`: UI da feature.
- `hooks/`: orquestração da biblioteca e operações de template.
- `state/`: store local da feature.
- `utils/`: helpers puros de transformação.
- `index.ts`: API pública.

## Limites
- Consumir via `@/features/custom-components`.
- Não acessar arquivos internos por deep import fora da feature.
