# Collaboration Feature

## Responsabilidade
Sincronização colaborativa em tempo real (sessão, cursores, presença e estado compartilhado de edição).

## Estrutura
- `components/` (implícito em arquivos `Collab*.tsx`): UI de colaboração.
- `hooks/` (arquivos `use*.ts`): integração de sync/highlight/bridge de estado.
- `state/`: provider e estado de sessão (planejado para evolução incremental).
- `index.ts`: API pública da feature.

## Limites
- Consumir via `@/features/collaboration`.
- Regras de domínio do diagrama permanecem em `@/features/diagram`.
