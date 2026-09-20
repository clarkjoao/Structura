# Bug 3 Discovery — Diagnóstico: Instabilidade do File System

**Branch:** `main`  
**Commit:** `49416c0` ("Feat/element registry complete (#227)")  
**Data:** 2026-09-16  
**Working tree:** clean  
**Escopo:** Bug 3 (Étapa 1 — Diagnóstico)  
**Melhorias relacionadas:** Melhoria 11 (import JSON fallback pasta), Melhoria 15 (drag-drop entre pastas)

---

## Sumário Executivo

A investigação identificou **4 cenários CRÍTICOS de perda de dados** e **3 cenários HIGH** que explicam a instabilidade do filesystem reportada pelo usuário. A raiz do problema é uma combinação de: (1) `localStorage` pausado durante conexão com pasta, eliminando qualquer backup; (2) revogação de permissão detectada apenas no próximo reconnect, não proativamente; (3) falhas de escrita no filesystem são silenciosas — logadas no console, mas invisíveis para o usuário; (4) edição em duas abas simultâneas racing sem nenhum mecanismo de lock.

---

## 1. Persistência em localStorage

### 1.1 Quota e Tratamento de Erros

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/LocalStorageAdapter.ts` | 70 | `setItemSync` não tem tratamento de erro — lança diretamente em quota/disable | HIGH |
| `src/infrastructure/persistence/LocalStorageAdapter.ts` | 137 | `forceSave` engole todos os erros silenciosamente, retorna apenas boolean | MEDIUM |
| `src/features/diagram/store/persist.config.ts` | 556 | Erros de quota chamam `_setStorageCritical` mas **não** mostram mensagem específica ao usuário — apenas `saveError` genérico | MEDIUM |
| `src/infrastructure/persistence/storageQuota.ts` | 1 | `isQuotaExceededError()` existe mas erros de quota não são surfaceados com mensagens específicas | MEDIUM |
| `src/features/diagram/store/saveStatus.store.ts` | 6 | Limiares de storage (3MB/4MB) são arbitrários — não refletem quotas reais dos browsers (Chrome 10MB, Firefox 10MB, Safari 1MB ou unlimited) | LOW |

### 1.2 Stores Separadas (Stores Independentes do main store)

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/features/diagram/store/icon-store.ts` | 71 | `icon-store` usa `createJSONStorage(() => localStorage)` diretamente — **não** passa pelo `LocalStorageAdapter`. Sem tratamento de quota, sem tracking de save status | HIGH |
| `src/features/diagram/store/icon-store.ts` | 15 | Falhas do icon-store são **invisíveis** para o `useSaveStatusStore` — não chamam `_setError` | HIGH |
| `src/features/element-presets/store/element-presets.store.ts` | 121 | `element-presets` store tem o mesmo problema — bypass do `LocalStorageAdapter` | MEDIUM |
| `src/features/canvas/preferences/canvas-preferences.store.ts` | 33 | `canvas-preferences` store também ignora tratamento de erros | LOW |

### 1.3 localStorage Desabilitado (Private Browsing)

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/LocalStorageAdapter.ts` | 54 | `getItem` captura erros genéricos e retorna `null`. **Não há distinção** entre "key não encontrada" e "storage indisponível". `setItem` lança erros genéricos sem detecção de Safari private mode | HIGH |

---

## 2. Persistência em Filesystem

### 2.1 API e Estrutura

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 1 | Usa **File System Access API** nativa do browser (`showDirectoryPicker`, `getFileHandle`, `getDirectoryHandle`, `createWritable`) — não OPFS nem Storage Foundation API | INFO |
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 45 | Handles são persistidos via **IndexedDB** (não strings serializadas) — `DB_NAME='structura-fs'`, `DB_STORE='handles'` | INFO |

### 2.2 Ciclo de Permissão

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 249 | **Conexão inicial:** `showDirectoryPicker({ mode: 'readwrite' })` → `verifyPermission` → save handle para IndexedDB | INFO |
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 204 | **Reconexão:** handle carregado do IndexedDB, permissão verificada via `queryPermission`. Se `'granted'` → ativa; se `'prompt'` → armazena como `_pendingHandle` | INFO |
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 233 | **Requisição de permissão:** método separado `requestReconnectPermission()` (não automático) — requer user gesture para chamar `requestPermission` | INFO |

### 2.3 Revogação de Permissão — **CRÍTICO**

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 289 | **CRÍTICO:** `writeDiagram` **não verifica** estado de permissão antes de executar. Se revogada no meio da sessão, `getFileHandle`/`createWritable` lançam — retorna `false` com apenas `console.error` | **CRITICAL** |
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 178 | `isConnected` verifica apenas se handle existe — **não** o estado real de permissão. Handle persiste em memória mesmo após revogação OS-level | **CRITICAL** |
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 204 | Revogação **só detectada** no próximo `tryReconnect` (boot ou reconnect explícito). **Nenhum** check periódico ou event-driven durante uso ativo | **CRITICAL** |
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 233 | `requestReconnectPermission()` falha silenciosamente se usuário negar — retorna `false` sem logging | HIGH |

### 2.4 Timing de Escrita

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/fileSystemBoot.ts` | 259 | Escritas do folder sync são **debounced em 800ms** (`VIEWPORT_DEBOUNCE_MS`) após mudanças na store, usando Promise chain para serialização | INFO |
| `src/infrastructure/persistence/fileSystemBoot.ts` | 92 | `flushWorkspaceToConnectedFolder` disponível para saves explícitos (Ctrl+S) mas **não wired** a beforeunload/pagehide. Apenas localStorage wired a esses eventos | MEDIUM |
| `src/infrastructure/persistence/fileSystemBoot.ts` | 325 | Deletions e moves são detectados: remove arquivo antigo **antes** de escrever novo | INFO |
| `src/infrastructure/persistence/fileSystemBoot.ts` | 337 | Deletion tem **fallback tombstone**: se `removeEntry` falha, reescreve arquivo como `{ deleted: true, id, deletedAt }` | INFO |

### 2.5 Tratamento de Erros de Escrita

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 301 | Falha em `writeDiagram` retorna `false` e loga `console.error` — **sem retry**, sem notificação ao usuário | MEDIUM |
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 378 | Falha em `writeManifest` retorna `false` — mesmo padrão | MEDIUM |
| `src/infrastructure/persistence/fileSystemBoot.ts` | 373 | Flush chain captura erros e loga, mas **não retenta** — próximo flush só após próxima store change | MEDIUM |

---

## 3. Sincronização localStorage ↔ Filesystem

### 3.1 Fonte de Verdade

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/useFileSystemStorage.ts` | 95 | **Filesystem é fonte de verdade quando conectado.** `defaultStorage.paused = true` é setado — localStorage writes são bypassados | **CRITICAL** |
| `src/infrastructure/persistence/fileSystemBoot.ts` | 165 | localStorage é **pausado, não substituído** — retém estado persistido. Se FS disconnect, localStorage retoma automaticamente | INFO |
| `src/infrastructure/persistence/folderSyncTimestamp.ts` | 7 | Timestamp de último sync salvo em localStorage, não em IndexedDB | INFO |

### 3.2 Reconciliação no Boot

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/fileSystemBoot.ts` | 171 | Boot-time reconciliation compara timestamps: se in-memory mais recente que FS, trigger **merge dialog** | **CRITICAL** |
| `src/hooks/useWorkspaceFocusSync.ts` | 64 | Tab focus trigger sync **apenas** quando manifest FS é mais recente que `lastFolderSync`. Usa tolerância de 3000ms para clock skew | **CRITICAL** |

### 3.3 Resolução de Conflitos

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/useFileSystemStorage.ts` | 274 | **Merge:** aditivo — diagramas do FS são **adicionados** ao estado in-memory (existentes preservados) | **CRITICAL** |
| `src/infrastructure/persistence/useFileSystemStorage.ts` | 341 | **Overwrite:** substitui estado in-memory pelo FS | **CRITICAL** |
| `src/infrastructure/persistence/workspace-manifest-fingerprint.ts` | 1 | Manifest fingerprinting **evita escritas redundantes** — hash de diagramIds (sorted), services, folders, etc. Exclui timestamps | INFO |

### 3.4 Multi-Tab — **CRÍTICO**

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/hooks/useWorkspaceFocusSync.ts` | 1 | **Nenhum mecanismo de coordenação cross-tab existe.** Sem `BroadcastChannel`, `SharedWorker`, ou storage event listener para cross-tab sync | **CRITICAL** |
| `src/infrastructure/persistence/LocalStorageAdapter.ts` | 6 | localStorage changes **não são monitoradas ativamente** — sem `window.addEventListener('storage', ...)` | MEDIUM |

### 3.5 Fluxo de Dados Completo

```
User edita diagrama
  → Zustand store update (in-memory, imediato)
  → Zustand persist middleware (PERSIST_DEBOUNCE_MS=1000ms)
  → wrapIStoragePortWithDiagramPersistTracking()
  → Adapter:
      (A) LocalStorageAdapter → localStorage (síncrono, ~5MB quota)
      OU
      (B) FileSystemAdapter → filesystem folder (assíncrono, ilimitado)

Folder sync em paralelo:
  useDiagramStore.subscribe
    → runDebouncedFlush() (VIEWPORT_DEBOUNCE_MS=800ms)
    → compara com lastFlushedDiagrams
    → computa diff (added/modified/deleted/moved)
    → escreve diagramas + manifest + deleta removidos

On reconnect:
  tryReconnect()
    → queryPermission
    → se 'prompt' → armazena como _pendingHandle
    → se 'granted' → loadWorkspace()
    → compara timestamps com in-memory
    → se in-memory mais recente → trigger boot conflict path
    → WorkspaceMergeDialog (user choice)
```

---

## 4. Sincronização da Árvore de Pastas

### 4.1 Mapeamento Pasta ↔ Diretório

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 106 | **Árvore de pastas é unidirecional: store→filesystem apenas.** Pasta nunca é lida do filesystem para a store. `_scanAllDiagrams` lê apenas `.json`, não nomes de diretórios | **CRITICAL** |
| `src/infrastructure/persistence/fileSystemBoot.ts` | 189 | **Nenhuma** detecção de mudanças externas. Se outro programa deleta/renomeia pastas, Structura não percebe até rescan explícito | HIGH |
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 97 | **Renomear pasta NÃO renomeia** diretório correspondente no filesystem. Caminho slugified novo é criado, antigo persiste — diagramas existem em ambos | HIGH |

### 4.2 Diagramas Órfãos

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 106 | Diagramas com `folderId` apontando para pasta deletada externamente são escritos na **raiz do workspace**, não órfãos | MEDIUM |
| `src/infrastructure/persistence/validateWorkspaceFile.ts` | 256 | `validateManifest` valida apenas versão (1 ou 2) e `diagramIds` (array). **Não valida** estrutura de folders, services, etc. | MEDIUM |

### 4.3 WORKSPACE_SCHEMA_VERSION

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/versions.ts` | 9 | `WORKSPACE_SCHEMA_VERSION = 2` é **decorativo**. Escrito nos manifest files mas **nenhuma lógica de migração existe**. `validateManifest` aceita v1/v2 mas retorna raw sem transformação | MEDIUM |

### 4.4 Move de Diagramas entre Pastas

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/features/diagram/store/slices/folders.slice.ts` | 46 | `moveDiagram` **é suportado** no store e no sync layer. Sync detecta moves via comparação de path segments e faz cleanup do arquivo antigo | LOW |
| `src/features/diagram/store/actions.types.ts` | 42 | Apenas `renameFolder` e `moveDiagram` expostos. **Não existe** `moveFolder`/`reparentFolder` — mover pasta para outro parent não suportado | MEDIUM |

---

## 5. Superfície de Erro e Observabilidade

### 5.1 Logging e Telemetria

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/lib/core/logger.ts` | 27 | **Logger estruturado existe mas NÃO é usado** na camada de persistência. Todos os erros usam `console.*` diretamente | MEDIUM |
| `N/A` | — | **Nenhuma telemetria, error tracking, ou analytics** existe no codebase. Falhas de persistência são invisíveis para devs sem acesso ao console do browser | HIGH |

### 5.2 Feedback ao Usuário

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/fileSystemBoot.ts` | 373 | Background debounced sync captura erros mas **não mostra nenhuma notificação**. Diagramas podem falhar silenciosamente | HIGH |
| `src/infrastructure/persistence/FileSystemAdapter.ts` | 301 | Falha de `writeDiagram` logada mas **nenhum toast** mostrado ao usuário | HIGH |
| `src/components/FileSystemStatus.tsx` | 50 | UI mostra apenas idade do sync baseada em tempo. **Nenhum estado de erro** renderizado para falhas de persistência | HIGH |
| `src/infrastructure/persistence/useFileSystemStorage.ts` | 558 | Catch block seta `status='error'` mas `FileSystemStatus` **nunca renderiza** esse estado — UI fica silenciosamente no estado anterior | HIGH |
| `src/infrastructure/persistence/useFileSystemStorage.ts` | 267, 334, 396 | Erros de merge/overwrite/push logados mas **apenas toast genérico** mostrado. Detalhes do erro perdidos | LOW |

### 5.3 Falhas de Backup e Sincronização

| Arquivo | Linha | Achado | Severidade |
|---------|-------|--------|------------|
| `src/infrastructure/persistence/fileSystemBoot.ts` | 179 | Falha no scan de conflitos no boot loga com `console.warn` mas deixa usuário em **estado indefinido** — carrega do disco silenciosamente | MEDIUM |
| `src/infrastructure/persistence/useFileSystemStorage.ts` | 240 | Operações destrutivas (merge, overwrite, push, disconnect) **sempre** fazem backup para localStorage primeiro com `force: true` | INFO |

---

## 6. Modos de Falha Críticos

### CRÍTICO — Perda de Dados Confirmada

| Cenário | O que acontece | Impacto no usuário | Evidência |
|---------|---------------|-------------------|-----------|
| **Permissão revogada no meio de edição** | `writeDiagram` falha, sync debounced falha silenciosamente, localStorage pausado = sem backup | Usuário perde TODAS as edições desde último sync bem-sucedido. Falha silenciosa | `FileSystemAdapter.ts:289`, `fileSystemBoot.ts:373` |
| **Quota excedida** | `LocalStorageAdapter.setItem` lança `QuotaExceededError`, `filesystem` não conectado = sem backup | Save falha, dados em risco | `persist.config.ts:556`, `LocalStorageAdapter.ts:70` |
| **Duas abas editando mesmo workspace** | Sem optimistic locking, last write wins. Tab A edita → Tab B edita → Tab A persiste → Tab B persiste, sobrescrevendo Tab A silenciosamente | Race condition — alterações sobrescritas sem notificação | `useWorkspaceFocusSync.ts:1` |
| **Tab fecha antes do sync** | `beforeunload` trigger `flushOnLeave`, mas localStorage pausado e filesystem pode falhar | Usuário perde edições. Estado de erro setado mas usuário não vê nada se tab já fechou | `fileSystemBoot.ts:92` |

### HIGH — Dados em Risco

| Cenário | O que acontece | Impacto no usuário | Evidência |
|---------|---------------|-------------------|-----------|
| **Escrita parcial de filesystem** | Diagramas escritos, manifesto falha. Manifesto não referencia diagramas | Workspace corrompido — diagramas no disco mas invisíveis ao recarregar | `fileSystemBoot.ts:373` |
| **Manifesto falha após escritas** | Manifesto inalterado, diagramas escritos no disco | Diagramas órfãos no próximo load | `FileSystemAdapter.ts:378` |
| **Race move/delete** | Sync detecta move, deleta arquivo antigo, escrita no novo falha | Diagrama perdido do filesystem, apenas em memória | `fileSystemBoot.ts:325` |

### MEDIUM — UX Degradado

| Cenário | O que acontece | Impacto no usuário | Evidência |
|---------|---------------|-------------------|-----------|
| **Zona de warning de quota (3-4MB)** | Banner amarelo shown, localStorage ainda aceita writes | Usuário ciente do limite aproximado mas sem caminho claro | `saveStatus.store.ts:6` |
| **Prompt de permissão** | needs_permission state, carrega de localStorage | Usuário pode não perceber que workspace não carregou | `useFileSystemStorage.ts:558` |

---

## 7. Inconsistências: Código vs. Documentação

| Afirmação na Documentação | Realidade no Código | Severidade |
|---------------------------|---------------------|------------|
| **ADR-0007:** "conflicts surface to the user; the app never silently discards a side" | **Verdadeiro** para cenários de connect/reconnect explícitos, mas **NÃO** para edição em duas abas — nenhum dialog aparece | CRITICAL |
| **ADR-0007:** "localStorage quota (~5MB)" | `docs/concepts/persistence.md` não menciona monitoramento de quota. Implementação real tem `storageQuota.ts` e banner de warning | MEDIUM |
| **docs/concepts/persistence.md:** "sync machinery exists to reconcile" localStorage cache + files | **Não menciona** que localStorage é PAUSADO quando pasta conectada (`defaultStorage.paused = true`) | MEDIUM |
| **ADR-0007:** menciona IndexedDB como "planned escape hatch" para quota | **Sem timeline ou implementação** — não existe fallback IndexedDB para dados de diagrama | MEDIUM |
| Ambos os docs descrevem conflict surface dialog | **Nenhum especifica** o que acontece se escrita no filesystem falha no meio do sync — código continua silenciosamente | MEDIUM |
| **docs/concepts/persistence.md:** lista o que persiste | **Não menciona** que `element_presets` storage key é separado do `PERSIST_KEY` principal | LOW |
| **docs/concepts/persistence.md:** "folders" persiste | **Não menciona** que a estrutura de pastas no disco é **nunca lida de volta** para a store — unidirecional | MEDIUM |

---

## 8. Perguntas para a Próxima Etapa (Proposta de Arquitetura)

### 8.1 Fonte de Verdade
- Quando a escrita no filesystem falha (não-permissão), a app deve surfacear banner de erro ou retry? Atualmente apenas loga no console.
- Deve existir um **backup para localStorage** em background mesmo quando pasta está conectada? Atualmente `paused=true` desabilita escritas no localStorage inteiramente.
- Na revogação de permissão do filesystem, deve-se fazer fallback para localStorage (com consentimento do usuário) ou mostrar erro persistente até reconectar?

### 8.2 Two-Tab Editing
- Deve haver `storage` event listener para detectar mudanças externas e fazer prompt de merge/reload?
- Qual é o comportamento esperado quando o manifesto existe mas nenhum arquivo de diagrama é encontrado no scan?

### 8.3 Operações de Escrita
- Se manifest write falha após diagram writes, deve-se implementar **two-phase commit** ou rollback?
- Deve haver **write "last resort"** para localStorage mesmo quando pausado, como seguro contra falhas de filesystem?
- O que acontece se IndexedDB está corrompido e o handle não pode ser carregado no boot?

### 8.4 Detecção de Mudanças Externas
- Como mudanças externas em pastas (operações git, outra ferramenta editando arquivos) devem ser detectadas? Atualmente detectadas apenas em connect/reconnect explícito.
- Deve-se implementar File System Observer API ou polling fallback?

### 8.5 Operações de Pasta
- O que deve acontecer quando uma pasta é deletada externamente? (a) órfã para root, (b) deleta, (c) preserva com warning, ou (d) previne via watcher externo?
- Deve renomear pasta trigger rename do diretório correspondente no filesystem, ou o comportamento unidirecional atual é intencional?
- Renomear pasta no filesystem deve ser lido de volta para a store?

### 8.6 Debounce e Timing
- Os debounces de sync (800ms) e persist (1000ms) devem ser coordenados? Podem causar issues de ordering atualmente.

### 8.7 Stores Separadas
- `icon-store`, `element-presets`, `canvas-preferences` devem usar `LocalStorageAdapter` para tratamento consistente de erros?

---

## 9. Cruzamento com Backlog

### Bug 3 — Instabilidade do File System (o gatilho deste discovery)
✅ **Diagnóstico completo.** 4 cenários CRÍTICOS identificados, 3 HIGH, 3 MEDIUM.

### Melhoria 11 — Import JSON: fallback de pasta + multi-import
**Confirmado:** O gap de divergência entre "o que a store acha que existe" e "o que existe de fato" é real. O comportamento de pasta ausente no import precisa ser verificado em `useWorkspaceImport.ts` — checagem deveria entrar lá, não no import de arquivo individual.

**Pré-condição para implementar com segurança:** Resolver a questão de "o que fazer quando a pasta de destino não existe" depende de definir claramente o comportamento de reconciliação store↔filesystem (seção 8.1).

### Melhoria 15 — Drag-and-drop entre pastas
**Mapeado:** O sync layer já suporta `moveDiagram` corretamente (detecção de path segments + cleanup de arquivo antigo em `fileSystemBoot.ts:309-323`). A ação `moveDiagram` existe no store (`folders.slice.ts:46-53`).

**Pré-condição para implementar com segurança:** A infraestrutura de sync existe mas a revogação de permissão não é detectada proativamente. Se o usuário mover um diagrama e a permissão for revogada durante o sync, pode resultar em diagrama com `folderId` atualizado mas arquivo ainda no caminho antigo. **Recomenda-se resolver Bug 3 primeiro** antes de implementar a feature UI.

---

## Anexo: Referências de Código

### Arquivos-Chave
- `src/infrastructure/persistence/fileSystemBoot.ts` — boot/sync lifecycle
- `src/infrastructure/persistence/FileSystemAdapter.ts` — File System Access API adapter
- `src/infrastructure/persistence/useFileSystemStorage.ts` — React hook de orquestração
- `src/features/diagram/store/persist.config.ts` — persist config com schema versioning
- `src/infrastructure/persistence/LocalStorageAdapter.ts` — localStorage adapter
- `src/features/diagram/store/saveStatus.store.ts` — save status tracking
- `src/components/FileSystemStatus.tsx` — UI de status
- `src/infrastructure/persistence/workspace-manifest-fingerprint.ts` — fingerprinting de manifest
- `src/hooks/useWorkspaceFocusSync.ts` — sync baseado em foco

### Documentação de Referência
- `docs/concepts/persistence.md` — arquitetura local-first
- `docs/adr/0007-local-first-persistence.md` — ADR de persistência
- `src/infrastructure/persistence/versions.ts` — constantes de versão
- `src/infrastructure/persistence/validateWorkspaceFile.ts` — validação de workspace

---

## Etapa 2 — Correções Aplicadas (2026-09-16)

### P0.1 — localStorage não é mais pausado quando FS conectado ✅

**Arquivos alterados:**
- `src/infrastructure/persistence/useFileSystemStorage.ts`
- `src/infrastructure/persistence/fileSystemBoot.ts`

**O que mudou:**
- Removidos todos os `defaultStorage.paused = true` (8 ocorrências)
- Removidos todos os `await clearLocalCache()` após operações de FS (4 ocorrências)
- `localStorage` agora recebe escritas em paralelo como backup silencioso quando pasta conectada
- Na desconexão (`performDisconnect`), `localStorage` continua disponível automaticamente

**Critério de aceite verificado:** Com pasta conectada, se o FS falhar, o estado do workspace está preservado no localStorage via persist middleware.

---

### P0.2 — Verificação ativa de permissão + erro visível na UI ✅

**Arquivos alterados:**
- `src/infrastructure/persistence/FileSystemAdapter.ts`
- `src/infrastructure/persistence/fileSystemBoot.ts`
- `src/infrastructure/persistence/useFileSystemStorage.ts`
- `src/components/FileSystemStatus.tsx`
- `src/infrastructure/i18n/locales/en.json`
- `src/infrastructure/i18n/locales/pt-BR.json`

**O que mudou:**
- `writeDiagram` e `writeManifest` agora chamam `queryPermission` antes de escrever; se não `'granted'` → seta `_hasPermissionError = true` e invoca callback
- `_flushChain` no `runDebouncedFlush` checa permissão antes de iniciar; invoca callback se negada
- `_hasPermissionError` é limpo em `tryReconnect`/`requestReconnectPermission` quando reconnect bem-sucedido
- `useFileSystemStorage` registra callback que seta `status='error'` quando em estado `'connected'`
- `FileSystemStatus` agora renderiza banner de erro com `AlertTriangle` e ação de reconectar
- Novas traduções: `filesystem.permissionLost` / `filesystem.permissionLostFolder`

**Critério de aceite verificado:** Revogar permissão durante sessão → UI mostra banner de erro em até uma escrita debounced, com botão para reconectar.

---

### P1.2 — Two-Phase Commit / Staged Writes ✅

**Arquivos alterados:**
- `src/infrastructure/persistence/stagedDiagramWrite.ts` (novo)
- `src/infrastructure/persistence/FileSystemAdapter.ts`
- `src/infrastructure/persistence/fileSystemBoot.ts`

**O que mudou:**

O sistema agora usa um protocolo de two-phase commit para todas as escritas ao filesystem:

```
Fase 1 (Prepare):
  1. Para cada diagrama modificado → escreve para {id}.json.tmp
  2. Tracking: array de StagedDiagramWrite[]

Fase 2 (Commit):
  1. writeManifestWithRetry() → tenta escrever manifest (3 retries com backoff)
  2. Se manifest OK:
     - commitStagedDiagrams() → renomeia .tmp → .json
     - Sincroniza fingerprint
  3. Se manifest falha:
     - rollbackStagedDiagrams() → deleta arquivos .tmp
     - Toast de erro ao usuário
```

**Proteções:**
- Se escrita de diagrama falhar → rollback imediato dos já escritos
- Se manifest falhar após diagramas → rollback completo dos .tmp
- Se commit (rename) falhar parcialmente → log de warning, manifest mantido válido
- Commit parcial não impede sync futuro (próximo flush tentará novamente)

**Comportamento de falha:**

| Cenário | Antes | Depois |
|---------|-------|--------|
| Diagramas escritos, manifest falha | Diagramas órfãos no disco | .tmp rollback, 0 diagramas órfãos |
| Espera de permissões entre writes | API nativa lança | queryPermission previne erro |
| Commit parcial | Nunca detectado | Console warning + retry automático |

**Arquivos de staging (.tmp):**
- São criados no mesmo diretório dos diagramas finais
- Commit preferencialmente via `FileSystemFileHandle.move()` (rename atômico);
  fallback copy+delete quando `move` não está disponível
- Se o app fechar durante o fallback copy+delete, os `.tmp` órfãos são
  removidos em connect/reconnect por `cleanupOrphanedTempFiles` (idade > 5 min)

---

### P1.3 — Sync Bidirecional de Pastas ✅

**Arquivos alterados:**
- `src/infrastructure/persistence/folderSync.ts` (novo)
- `src/infrastructure/persistence/FileSystemAdapter.ts` (adicionado `scanDirectoryStructure`, `createDirectory`, `deleteDirectory`)
- `src/infrastructure/persistence/fileSystemBoot.ts` (adicionado `syncFoldersFromFilesystem`, folder watcher)
- `src/infrastructure/persistence/useFileSystemStorage.ts` (integrado sync no connect/reconnect/merge/overwrite)
- `src/infrastructure/i18n/locales/en.json`
- `src/infrastructure/i18n/locales/pt-BR.json`

**O que mudou:**

O sistema agora sincroniza a estrutura de pastas bidirecionalmente:

```
FS → Store (Leitura):
  - scanDirectoryStructure() → lista diretórios do filesystem
  - Detecta pastas externas criadas no filesystem
  - Cria pastas correspondentes no store

Store → FS (Escrita):
  - Diretórios são criados no flush de diagramas (`getOrCreateDirectory`),
    não por um folder watcher separado (o watcher anterior causava
    "Maximum update depth exceeded" no React Flow)
  - Não deleta diretórios automaticamente (segurança)
```

**Fluxo:**
1. On connect/reconnect: `syncFoldersFromFilesystem()` reconcilia estrutura
2. On folder created in app: Directory criado automaticamente
3. On folder deleted in app: Directory permanece (pode ter arquivos externos)

**Proteções:**
- Diretórios não são deletados automaticamente quando pasta é removida
- Pasta usa ID como nome de diretório (mantém compatibilidade)
- Folder watcher integrado ao sync existente

---

### Não implementado nesta etapa (escopo)

| Item | Status | Motivo |
|------|--------|--------|
| P1.1 — Renomear pasta renomeia diretório real | Aguardando confirmação do usuário | Decisão de UX necessária |
| Multi-tab coordination | Adiado | Requer redesign estrutural |
| WORKSPACE_SCHEMA_VERSION migração real | Adiado | Decorativo por enquanto |
