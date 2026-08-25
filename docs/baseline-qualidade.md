# Baseline de qualidade — PR 0 (recuperar a capacidade de medir)

> Medições feitas em worktree nova (`/tmp/structura-pr0`) a partir do branch
> `chore/pr0-restore-measurement` no commit `897a31c` (HEAD do
> `feat/remove-walkthrough`).
>
> Data: 2026-08-25 (UTC). Ambiente: macOS Darwin 25.6.0, Node 20.x.

Este arquivo substitui a contagem anterior de 252 problemas de lint, que veio de uma medição impossível (o lint não executava naquele momento). O objetivo é fornecer a baseline que o PR seguinte (limpeza de lint) precisa.

## Comando único de reprodutibilidade

```sh
# Em uma worktree nova:
npm ci
npm run typecheck && npm test && npm run lint && npm run format:check && npm run build
```

O `npm ci` desta baseline executou em ~21s sem `--legacy-peer-deps`.

## Resumo

| portão | resultado | exit | nota |
|---|---|---|---|
| `npm ci` | 752 pacotes instalados, 0 conflitos reportados | 0 | sem `--legacy-peer-deps` |
| `npm run typecheck` | 0 erros | 0 | `tsc -b` sem diagnósticos |
| `npm test` | 98 test files / 758 tests passando | 0 | 0 falhas |
| `npm run lint` | **228 problemas** (193 errors, 35 warnings) | 1 | ver agrupamento por regra |
| `npm run format:check` | **95 arquivos** com divergência | 0 | prettier `--check` retorna 0 mesmo com warns |
| `npm run build` | OK em **3.39s** (12s wall com overhead do npm) | 0 | ver tamanhos de bundle |
| `npm run plugins:sync-check` | `sync-types` em dia; `sync-shared` reporta `out of date` | 0 | pré-existente, fora de escopo |

## `npm test` (detalhe)

```
Test Files  98 passed (98)
     Tests  758 passed (758)
  Duration  17.59s
```

**Zero arquivos de teste falhando.** O número "8 test files falhando" que aparece em PRs anteriores (e no briefing deste PR) se referia ao estado em que o repo ainda usava `tailwindcss@^4.3.3` (antes do downgrade para 3.4.19 feito em `897a31c`). Na baseline atual, com Tailwind 3.4.19 instalado e `postcss.config.js` apontando para `tailwindcss: {}` direto, todos os testes passam.

## `npm run lint` (agrupado por regra, do mais frequente para o menos)

| # | regra | contagem | severidade |
|---|---|---:|---|
| 1 | `react-hooks/refs` | 86 | error |
| 2 | `react-hooks/set-state-in-effect` | 49 + 1 = 50 | error + warning |
| 3 | `@typescript-eslint/no-unused-vars` | 35 | error |
| 4 | `react-refresh/only-export-components` | 27 | warning |
| 5 | `react-hooks/exhaustive-deps` | 1 + 7 = 8 | error + warning |
| 6 | `react-hooks/immutability` | 8 | error |
| 7 | `react-hooks/static-components` | 5 | error |
| 8 | `no-useless-assignment` | 4 | error |
| 9 | `react-hooks/preserve-manual-memoization` | 2 | error |
| 10 | `prefer-const` | 2 | error |
| 11 | `react-hooks/purity` | 1 | error |
| 12 | unused `eslint-disable no-console` directive | 1 | warning |
| **total** |  | **228** | 193 errors + 35 warnings |

Observações para o PR de limpeza:

- `react-hooks/refs` (86) e `react-hooks/set-state-in-effect` (50) dominam — juntos são **136 dos 228**. Vêm do plugin `eslint-plugin-react-hooks@^7.1.1`. Esses números têm cara de ser ruído de configuração (as regras são novas na 7.x); vale investigar se rebaixar para warning ou ajustar configuração reduz o ruído sem perder o sinal.
- `@typescript-eslint/no-unused-vars` (35) é o único item não-react-hooks com peso real. Esses são correções reais (apagar imports/variáveis não usados).
- `react-refresh/only-export-components` (27, warning) é a regra de hot-reload do Vite. Geralmente ruído em código maduro.
- `react-hooks/exhaustive-deps` (8, warning) — possíveis bugs latentes (dependências faltantes em `useMemo`/`useCallback`).
- Os 9 itens restantes (`immutability`, `static-components`, `no-useless-assignment`, `preserve-manual-memoization`, `prefer-const`, `purity`, `no-console`) somam 23 e devem ser revisados caso a caso.

## `npm run build` (bundles principais)

`tsc -b && vite build`, **3.39s** (tempo do vite build; tempo total incluindo overhead do npm ~12s). 6624 módulos transformados.

Top bundles (sem gzip / com gzip):

| arquivo | tamanho | gzip |
|---|---:|---:|
| `dist/assets/index-CUIj6mv6.css` | 98.06 kB | 16.59 kB |
| `dist/assets/editor-DOgAgpTS.css` | 146.06 kB | 22.61 kB |
| `dist/assets/CollabRoom-BdANXSjb.css` | 16.47 kB | 2.95 kB |
| `dist/assets/index.esm-COo0Na4F.js` | 1,613.12 kB | 448.97 kB |
| `dist/assets/editor.api2-Boe5YBSY.js` | 3,625.06 kB | 926.45 kB |
| `dist/assets/elk.bundled-CHA7LmpY.js` | 1,432.42 kB | 441.77 kB |
| `dist/assets/CollabRoom-GGs0hN_G.js` | 1,133.08 kB | 318.64 kB |
| `dist/assets/diagram-BZeI9ccy.js` | 826.17 kB | 240.63 kB |

CSS gerado verificado: dark mode (`.dark { --background: … }`), classes `prose` (usadas em `NoteNode.tsx`) e animações (`@keyframes enter|exit|pulse|pulse-glow|spin`, classes `animate-*`) estão presentes no bundle. Tailwind 3.4.19 (não 4.x) está instalado, então o `postcss.config.js` no formato antigo (`tailwindcss: {}` direto) está correto e não precisa de migração para `@tailwindcss/postcss`.

## Mudanças incluídas neste PR

Nenhuma mudança de código de feature. Apenas:

1. **`package.json`** — adicionado `@testing-library/dom: "10.4.1"` em `devDependencies`. Era peer dep faltante do `@testing-library/react@16`. A resolução existia via `package-lock.json` (instalado transitivamente), mas não estava declarada, o que fragilizava instalações futuras que dependessem do `npm install` (sem `ci`) ou que regenerassem o lockfile.
2. **`package-lock.json`** — atualizado para refletir (1).
3. **`docs/baseline-qualidade.md`** — este arquivo.

## O que não foi corrigido (e por quê)

| item | motivo |
|---|---|
| 228 problemas de lint | O trabalho de lint é o PR seguinte e precisa desta baseline. |
| 95 arquivos fora do prettier | `prettier --write` está fora de escopo explícito. |
| `tailwind.config.ts` em sintaxe v3 | Tailwind 3.4.19 está instalado (downgrade feito em `897a31c`). A config antiga é a correta. Não há migração a fazer. |
| `plugins:sync-check` reporta `out of date` | Pré-existente, fora de escopo. |
| Peer dep `typescript-eslint` vs TS 6.0.3 | O `npm ci` aceita, o lint executa. `typescript-eslint@8.68.0` (latest) declara o mesmo range `<6.1.0`; não há versão publicada que aceite TS 6+. A correção real (downgrade do TS para 5.x) é regressão, não foi aplicada. |