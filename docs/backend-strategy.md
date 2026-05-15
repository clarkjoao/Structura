# Structura — NestJS Backend Strategy

**Author:** Staff Engineer Analysis  
**Date:** 2026-05-15  
**Status:** Proposal (no implementation)

---

## Table of Contents

1. [Diagnóstico do Estado Atual](#1-diagnóstico-do-estado-atual)
2. [Modelo de Domínio Proposto](#2-modelo-de-domínio-proposto)
3. [Modelo Relacional (PostgreSQL)](#3-modelo-relacional-postgresql)
4. [Estratégia de Versionamento](#4-estratégia-de-versionamento)
5. [Arquitetura NestJS Proposta](#5-arquitetura-nestjs-proposta)
6. [API REST Proposta](#6-api-rest-proposta)
7. [Integração com o Frontend](#7-integração-com-o-frontend)
8. [Riscos e Trade-offs](#8-riscos-e-trade-offs)
9. [Plano Incremental de Implementação](#9-plano-incremental-de-implementação)

---

## 1. Diagnóstico do Estado Atual

### 1.1 Tipos Principais

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| `Diagram` | `src/features/diagram/model/diagram.types.ts` | Entidade raiz. Contém `id`, `name`, `description`, `level`, `domain`, `createdAt`, `updatedAt`, `snapshot` (ModelDraft), `nodeLayouts`, `edgeLayouts`, `viewport`, `folderId`, `scenes`, `activeSceneId`. |
| `ModelDraft` (Snapshot) | `src/features/diagram/model/diagram.types.ts` | Grafo completo: `components`, `connections`, `flows`, `iconLibrary` — todos como `Record<string, T>`. |
| `Component` | `src/features/diagram/model/component.types.ts` | Union type discriminada por `type`: `C4Component`, `PanelComponent`, `NoteComponent`, `AwsComponent`, `ApiGroupComponent`, `EndpointComponent`, `DbTableComponent`, `JsonViewerComponent`, `SvgComponent`, `UnknownComponent`. |
| `Connection` | `src/features/diagram/model/connection.types.ts` | Aresta entre componentes: `sourceId`, `targetId`, `label`, `technology`, `intent`, `direction`, `style`. |
| `Flow` | `src/features/diagram/model/flow.types.ts` | Grafo de passos: `steps: Record<string, FlowStep>`, `entryStepId`, `mermaid`, `diagramId`. |
| `FlowStep` | `src/features/diagram/model/flow.types.ts` | Nó de um flow: `type` (action/condition/note), `componentId`, `connectionId`, branches. |
| `Folder` | `src/features/diagram/model/diagram.types.ts` | Estrutura de pastas: `id`, `name`, `parentId`, `domain`. |
| `SceneDiff` | `src/features/diagram/model/diagram.types.ts` | Overlay sobre diagrama base: componentes/conexões adicionados/removidos, viewport e layouts. |
| `NodeLayout` / `EdgeLayout` | `src/features/diagram/model/layout.types.ts` | Posição e dimensões dos nós/arestas no canvas. |
| `IconDefinition` | `src/features/diagram/model/diagram.types.ts` | Ícone customizado: `source` (SVG/Lucide/AWS), `usageCount`. |
| `UserTemplate` | `src/features/diagram/model/diagram.types.ts` | Template de padrão criado pelo usuário com componentes e conexões relativos. |
| `ServiceDefinition` | `src/features/diagram/model/service.types.ts` | Registro de serviço: `repositoryUrl`, `technology`, `owner`, `sources` (GitHub/DefectDojo/Manual). |
| `DiagramSnapshot` (Undo) | `src/features/diagram/store/store.types.ts` | Snapshot para undo: `diagramId`, `snapshot` (ModelDraft), `nodeLayouts`, `timestamp`. |

### 1.2 Estado e Persistência

**Store principal:** `diagram.store.ts` — Zustand com middleware `persist(immer(...))`.

**Estado persistido (`AppState`):**
- `diagrams: Record<string, Diagram>` — todos os diagramas
- `folders: Record<string, Folder>` — árvore de pastas
- `userTemplates: Record<string, UserTemplate>` — templates do usuário
- `serviceRegistry: Record<string, ServiceDefinition>` — registro de serviços
- `activeDiagramId: string | null`

**Estado transiente (não persistido):**
- `past: DiagramSnapshot[]` — stack de undo (max 30)
- `future: DiagramSnapshot[]` — stack de redo
- `clipboard: ClipboardEntry | null`
- `_lastUndoRedoAt: number`

**Mecanismos de persistência:**

| Mecanismo | Chave | Dados |
|-----------|-------|-------|
| localStorage (Zustand persist) | `structura_diagram-store` | Diagrams, folders, templates, registry, activeDiagramId |
| localStorage (Zustand persist) | `structura:journeys` | Journeys (feature separada) |
| localStorage (Zustand persist) | `structura:custom-components` | Custom component templates |
| localStorage (Zustand persist) | `structura:icon-library` | Ícones globais |
| localStorage (manual) | `structura:llm:config` / `structura:llm:history` | Config e histórico do chat LLM |
| IndexedDB | `structura-fs` | Apenas o `FileSystemDirectoryHandle` do workspace local |
| File System Access API | Pasta do usuário | Diagramas como `{id}.json`, manifest, journeys JSON |

**Debounce de persistência:** 1000ms com flush no `beforeunload`.

**Schema version:** 5 — com pipeline de migração robusto (`mergePersistedState`) que roda 10+ migrações na hidratação.

**File System Adapter:** Quando o usuário conecta uma pasta local via File System Access API, o `LocalStorageAdapter.paused` é setado para `true` e o sync primário passa a ser arquivos JSON na pasta. Um `structura-manifest.json` serve como índice.

### 1.3 Export/Import

| Formato | Direção | Arquivo |
|---------|---------|---------|
| JSON (Structura nativo) | Export/Import | `src/lib/export-service/export-json.ts`, `ImportModal.tsx` |
| Draw.io XML | Export/Import | `export-drawio.ts`, `import-drawio.ts` |
| Structurizr DSL | Export/Import | `export-structurizr.ts`, `import-structurizr.ts` |
| Mermaid | Export/Import | `export-mermaid.ts`, `import-mermaid-sequence.ts` |
| ZIP (múltiplos) | Export | `download-file.ts` (usa JSZip) |
| Embed (iframe) | Export | `StructuraEmbed.tsx` — `postMessage` com objeto diagrama |

Não existe export de imagem raster (PNG). Existem previews SVG gerados internamente (`generatePreviewSvg.ts`) e cacheados em localStorage.

### 1.4 Undo/Redo

Implementação custom em `src/features/diagram/store/slices/history.slice.ts`:

- **Modelo:** Snapshot completo (`ModelDraft` + `nodeLayouts`) clonado com `structuredClone`.
- **Limite:** 30 snapshots (`MAX_HISTORY_STEPS`).
- **Coalescing:** Mutações "soft" dentro de 1500ms são agrupadas. Mutações "structural" forçam checkpoint.
- **Cooldown:** 50ms entre undo/redo.
- **Escopo:** Por diagrama ativo; `past`/`future` são limpos ao trocar de diagrama.
- **Integração LLM:** `ensureHistoryBoundary` é chamado antes de patches do LLM.

### 1.5 Conceito de Workspace/Inventário

- **Workspace:** Existe como conceito implícito — o store inteiro é "o workspace". Na UI, o breadcrumb raiz é "Workspace". Não há múltiplos workspaces.
- **Folders:** Suportados com hierarquia (`parentId`). Diagramas são atribuídos via `folderId`.
- **Dashboard:** `src/pages/dashboard/index.tsx` — listagem com grid/list view, sort por nome/domain/level/updatedAt, filtro por domain, busca global por componentes, drag-and-drop de diagramas entre pastas.
- **Projects:** Não existe como entidade.
- **Multi-user:** Existe colaboração via WebRTC (`src/features/collaboration/`), mas é P2P em sessão, sem persistência multi-tenant.

### 1.6 Arquivos Impactados em Integração Futura

| Camada | Arquivos | Impacto |
|--------|----------|---------|
| Store principal | `diagram.store.ts`, `diagram.slice.ts`, `persist.config.ts` | Adicionar sync remoto, substituir/complementar localStorage |
| Persistence | `LocalStorageAdapter.ts`, `IStoragePort.ts`, `FileSystemAdapter.ts` | Novo adapter para API REST |
| Dashboard | `src/pages/dashboard/index.tsx`, `DiagramGrid.tsx`, `DiagramCard.tsx` | Paginação, loading states, fetch remoto |
| Export/Import | `src/lib/export-service/` | Endpoint para salvar versões |
| Actions | `actions.types.ts`, slices em `store/slices/` | Chamadas async para backend |
| Collaboration | `src/features/collaboration/` | Potencial integração com backend para signaling |

---

## 2. Modelo de Domínio Proposto

```
┌──────────────────────────────────────────────────────────┐
│                        Workspace                         │
│  id, name, slug, ownerId, createdAt, updatedAt           │
├──────────────────────────────────────────────────────────┤
│  hasMany: Project                                        │
│  hasMany: Member (through WorkspaceMember)                │
└──────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│                         Project                          │
│  id, workspaceId, name, description, createdAt           │
├──────────────────────────────────────────────────────────┤
│  belongsTo: Workspace                                    │
│  hasMany: Folder                                         │
│  hasMany: Diagram (diretamente, sem folder)              │
└──────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│                         Folder                           │
│  id, projectId, parentId (self-ref), name, domain        │
│  position (ordering), createdAt                          │
├──────────────────────────────────────────────────────────┤
│  belongsTo: Project                                      │
│  hasMany: Folder (children)                              │
│  hasMany: Diagram                                        │
└──────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│                        Diagram                           │
│  id, projectId, folderId?, name, description, level      │
│  domain, currentVersionId, archivedAt, createdAt,        │
│  updatedAt                                               │
├──────────────────────────────────────────────────────────┤
│  belongsTo: Project                                      │
│  belongsTo: Folder (optional)                            │
│  hasMany: DiagramVersion                                 │
│  hasOne: DiagramVersion (currentVersion)                 │
│  hasMany: Tag (through DiagramTag)                       │
└──────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│                    DiagramVersion                        │
│  id, diagramId, versionNumber (serial), snapshot (JSONB) │
│  nodeLayouts (JSONB), edgeLayouts (JSONB), message       │
│  createdById, createdAt                                  │
├──────────────────────────────────────────────────────────┤
│  belongsTo: Diagram                                      │
│  snapshot = ModelDraft (components, connections, flows,   │
│             iconLibrary)                                 │
└──────────────────────────────────────────────────────────┘
```

### Entidades Complementares

| Entidade | Justificativa |
|----------|---------------|
| **User** | Autenticação e ownership. Campos: `id`, `email`, `name`, `avatarUrl`, `createdAt`. |
| **WorkspaceMember** | Relação N:N User-Workspace com `role` (owner/admin/member/viewer). |
| **Tag** | Classificação flexível. Campos: `id`, `workspaceId`, `name`, `color`. |
| **DiagramTag** | Join table Diagram-Tag. |

### Decisões de Design

1. **Workspace > Project > Folder > Diagram:** Hierarquia que escala de uso individual a times. Para MVP, um workspace padrão é criado automaticamente, com um projeto padrão.
2. **`currentVersionId` no Diagram:** Ponteiro para a versão ativa, evitando queries para "última versão" e permitindo rollback sem deletar versões.
3. **Sem `DiagramSnapshot` como entidade separada:** Cada "save" gera uma `DiagramVersion`. O conceito de snapshot do frontend (undo/redo) permanece client-side.
4. **Scenes como parte do snapshot JSONB:** Scenes (`SceneDiff`) são overlays sobre o diagrama base e fazem sentido como dados denormalizados no snapshot da versão.

---

## 3. Modelo Relacional (PostgreSQL)

### 3.1 DDL Proposto

```sql
-- ============================================================
-- Users & Auth
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Workspaces
-- ============================================================
CREATE TABLE workspaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    owner_id    UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

-- ============================================================
-- Projects
-- ============================================================
CREATE TABLE projects (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT,
    archived_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_workspace ON projects(workspace_id)
    WHERE archived_at IS NULL;

-- ============================================================
-- Folders
-- ============================================================
CREATE TABLE folders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    domain      TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_folders_project_parent ON folders(project_id, parent_id);

-- ============================================================
-- Diagrams
-- ============================================================
CREATE TABLE diagrams (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    folder_id           UUID REFERENCES folders(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    level               TEXT NOT NULL DEFAULT 'context',
    domain              TEXT,
    current_version_id  UUID,  -- FK adicionada após criar diagram_versions
    archived_at         TIMESTAMPTZ,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagrams_project ON diagrams(project_id)
    WHERE archived_at IS NULL;
CREATE INDEX idx_diagrams_folder ON diagrams(folder_id)
    WHERE archived_at IS NULL;

-- ============================================================
-- Diagram Versions
-- ============================================================
CREATE TABLE diagram_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id      UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    snapshot        JSONB NOT NULL,          -- ModelDraft
    node_layouts    JSONB NOT NULL DEFAULT '{}',
    edge_layouts    JSONB NOT NULL DEFAULT '{}',
    viewport        JSONB,                   -- {x, y, zoom}
    scenes          JSONB,                   -- Record<string, SceneDiff>
    message         TEXT,                    -- commit message do save
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (diagram_id, version_number)
);

CREATE INDEX idx_versions_diagram ON diagram_versions(diagram_id);
CREATE INDEX idx_versions_diagram_latest
    ON diagram_versions(diagram_id, version_number DESC);

-- FK circular: diagrams.current_version_id -> diagram_versions
ALTER TABLE diagrams
    ADD CONSTRAINT fk_current_version
    FOREIGN KEY (current_version_id)
    REFERENCES diagram_versions(id)
    ON DELETE SET NULL;

-- ============================================================
-- Tags
-- ============================================================
CREATE TABLE tags (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    color         TEXT,
    UNIQUE (workspace_id, name)
);

CREATE TABLE diagram_tags (
    diagram_id  UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (diagram_id, tag_id)
);
```

### 3.2 Estratégia de Soft Delete / Archive

- **Diagrams e Projects:** Campo `archived_at TIMESTAMPTZ`. Queries padrão filtram `WHERE archived_at IS NULL` (índices parciais garantem performance).
- **Sem soft delete em Folders:** Delete cascade — ao deletar uma folder, diagramas perdem o `folder_id` (`ON DELETE SET NULL`), não são deletados.
- **Sem soft delete em Versions:** Versões são append-only, não são deletadas. Para compliance/GDPR, uma política de retenção pode ser aplicada via cron.

### 3.3 JSONB — O Que Guardar

O campo `snapshot` (JSONB) armazena o `ModelDraft` completo:

```json
{
  "components": { "<id>": { "id": "...", "type": "system", "name": "...", ... } },
  "connections": { "<id>": { "id": "...", "sourceId": "...", ... } },
  "flows":       { "<id>": { "id": "...", "name": "...", "steps": {...}, ... } },
  "iconLibrary": { "<id>": { "id": "...", "source": {...}, ... } }
}
```

**Por que JSONB e não tabelas normalizadas para components/connections:**
1. O frontend já trabalha com o grafo completo em memória — normalizar e remontar seria overhead sem benefício.
2. Queries sobre conteúdo interno de diagramas (buscar componente por nome) podem usar operadores JSONB com índices GIN quando necessário.
3. Uma versão é imutável — não há updates parciais no snapshot.

**Índice GIN opcional (futuro):**
```sql
CREATE INDEX idx_versions_snapshot_gin
    ON diagram_versions USING GIN (snapshot jsonb_path_ops);
```

---

## 4. Estratégia de Versionamento

### 4.1 Comparação

| Abordagem | Prós | Contras | Complexidade |
|-----------|------|---------|--------------|
| **Snapshot completo** | Simples, restore instantâneo, sem dependências entre versões | Mais storage por versão (~10-200KB por diagrama típico) | Baixa |
| **Diff entre versões** | Menos storage, mostra exatamente o que mudou | Restore requer replay de diffs, complexidade de merge, JSON diff é não-trivial | Alta |
| **Event sourcing** | Auditoria completa, replay, undo nativo | Complexidade altíssima, projeções, eventual consistency, overkill para MVP | Muito alta |

### 4.2 Recomendação: Snapshot Completo

**Para o MVP, snapshot completo é a escolha correta.**

**Justificativas:**

1. **Tamanho prático:** Um diagrama com 50 componentes, 40 conexões e 5 flows gera ~50-100KB de JSON. Mesmo com 100 versões, são 5-10MB por diagrama — trivial para PostgreSQL.
2. **Restore instantâneo:** Apontar `current_version_id` para qualquer versão. Sem replay, sem dependência.
3. **Simplicidade de implementação:** O frontend já serializa o diagrama completo — é o mesmo JSON.
4. **Alinhamento com o frontend:** O undo/redo do frontend já usa snapshot completo.
5. **Diff pode ser derivado:** Se necessário mostrar diff entre versões na UI, um `json-diff` pode ser computado on-demand sem impactar o modelo de armazenamento.

**Otimizações futuras (não para MVP):**

- Compressão JSONB (PostgreSQL TOAST já faz isso por padrão para valores > 2KB).
- Retenção: manter últimas N versões + versões marcadas como "milestone".
- Deduplicação: se o snapshot não mudou, não criar nova versão (comparação de hash).

---

## 5. Arquitetura NestJS Proposta

### 5.1 Estrutura de Módulos

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/                     # Shared utilities
│   │   ├── decorators/             # @CurrentUser, @Workspace
│   │   ├── guards/                 # AuthGuard, WorkspaceRoleGuard
│   │   ├── filters/                # HttpExceptionFilter
│   │   ├── pipes/                  # UuidValidationPipe
│   │   └── interceptors/           # ResponseTransformInterceptor
│   │
│   ├── auth/                       # AuthModule
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts      # POST /auth/login, /auth/register, /auth/refresh
│   │   ├── auth.service.ts         # JWT issue/verify, password hash
│   │   ├── strategies/             # JwtStrategy, LocalStrategy
│   │   └── dto/                    # LoginDto, RegisterDto
│   │
│   ├── workspaces/                 # WorkspacesModule
│   │   ├── workspaces.module.ts
│   │   ├── workspaces.controller.ts
│   │   ├── workspaces.service.ts
│   │   ├── workspaces.repository.ts
│   │   └── dto/
│   │
│   ├── projects/                   # ProjectsModule
│   │   ├── projects.module.ts
│   │   ├── projects.controller.ts
│   │   ├── projects.service.ts
│   │   ├── projects.repository.ts
│   │   └── dto/
│   │
│   ├── folders/                    # FoldersModule
│   │   ├── folders.module.ts
│   │   ├── folders.controller.ts
│   │   ├── folders.service.ts
│   │   ├── folders.repository.ts
│   │   └── dto/
│   │
│   ├── diagrams/                   # DiagramsModule
│   │   ├── diagrams.module.ts
│   │   ├── diagrams.controller.ts  # CRUD + archive/restore/duplicate
│   │   ├── diagrams.service.ts     # Orquestra save + versioning
│   │   ├── diagrams.repository.ts
│   │   └── dto/
│   │
│   ├── diagram-versions/           # DiagramVersionsModule
│   │   ├── diagram-versions.module.ts
│   │   ├── diagram-versions.controller.ts  # list, get, restore
│   │   ├── diagram-versions.service.ts
│   │   ├── diagram-versions.repository.ts
│   │   └── dto/
│   │
│   └── database/                   # DatabaseModule
│       ├── database.module.ts
│       ├── migrations/
│       └── typeorm.config.ts       # ou prisma.schema
```

### 5.2 Responsabilidades por Módulo

#### AuthModule
- **Controller:** Login, register, refresh token, logout.
- **Service:** JWT (access + refresh tokens), bcrypt password hashing.
- **Estratégia:** Passport JWT. Stateless. Tokens curtos (15min access, 7d refresh).
- **Nota MVP:** Pode iniciar com autenticação simples (email/password) e evoluir para OAuth (GitHub, Google) posteriormente.

#### WorkspacesModule
- **Controller:** CRUD workspace, listar membros, convidar membro.
- **Service:** Criar workspace com membro owner, validar slug único, gerenciar membros.
- **Repository:** Queries em `workspaces` e `workspace_members`.
- **Nota MVP:** Workspace default criado no registro do usuário. UI de gerenciamento pode vir depois.

#### ProjectsModule
- **Controller:** CRUD projetos dentro de um workspace, archive/restore.
- **Service:** Validar permissões do workspace, gerenciar ciclo de vida.
- **Repository:** Queries em `projects` com filtro por `workspace_id`.

#### FoldersModule
- **Controller:** CRUD folders dentro de um projeto, reordenar.
- **Service:** Validar hierarquia (max depth), resolver árvore.
- **Repository:** Queries recursivas com CTE para árvore de pastas.

#### DiagramsModule
- **Controller:** CRUD diagramas, archive/restore, duplicate, move entre folders.
- **Service:** Orquestra criação de diagrama + primeira versão, duplicate com deep clone do snapshot, busca com paginação.
- **Repository:** Queries em `diagrams` com joins para última versão.
- **Lógica chave:** Ao salvar, chama `DiagramVersionsService.createVersion()` e atualiza `current_version_id`.

#### DiagramVersionsModule
- **Controller:** Listar versões, obter versão específica, restaurar versão.
- **Service:** Criar versão (incrementar `version_number`), restaurar (criar nova versão com snapshot antigo + atualizar ponteiro).
- **Repository:** Queries em `diagram_versions` ordenadas por `version_number DESC`.

### 5.3 ORM / Query Builder

**Recomendação: TypeORM ou Prisma.**

- **TypeORM:** Mais maduro com NestJS, suporte nativo a migrations, bom para JSONB.
- **Prisma:** DX superior, type safety forte, mas JSONB é tratado como `Json` opaco.

Para este projeto, **TypeORM** é ligeiramente preferível pelo controle mais fino sobre JSONB e migrations.

---

## 6. API REST Proposta

### 6.1 Endpoints

#### Workspaces
```
GET    /workspaces                          # Listar workspaces do usuário
POST   /workspaces                          # Criar workspace
GET    /workspaces/:workspaceId             # Detalhes do workspace
PATCH  /workspaces/:workspaceId             # Atualizar workspace
```

#### Projects
```
GET    /workspaces/:wId/projects            # Listar projetos
POST   /workspaces/:wId/projects            # Criar projeto
GET    /projects/:projectId                 # Detalhes do projeto
PATCH  /projects/:projectId                 # Atualizar projeto
DELETE /projects/:projectId                 # Arquivar projeto (soft)
POST   /projects/:projectId/restore         # Restaurar projeto
```

#### Folders
```
GET    /projects/:pId/folders               # Listar folders (árvore ou flat)
POST   /projects/:pId/folders               # Criar folder
PATCH  /folders/:folderId                   # Atualizar folder (rename, move)
DELETE /folders/:folderId                   # Deletar folder
```

#### Diagrams (Inventário)
```
GET    /projects/:pId/diagrams              # Listar diagramas (paginado, filtros)
       ?folderId=...                        #   filtro por folder
       ?level=context|container|component   #   filtro por nível C4
       ?domain=...                          #   filtro por domínio
       ?search=...                          #   busca por nome/descrição
       ?archived=true                       #   incluir arquivados
       &page=1&limit=20                     #   paginação
       &sort=updatedAt&order=desc           #   ordenação

POST   /projects/:pId/diagrams              # Criar diagrama (com snapshot inicial)
GET    /diagrams/:diagramId                 # Obter diagrama completo (com snapshot atual)
PATCH  /diagrams/:diagramId                 # Atualizar metadata (name, level, domain, folderId)
DELETE /diagrams/:diagramId                 # Arquivar diagrama (soft delete)
POST   /diagrams/:diagramId/restore         # Restaurar diagrama arquivado
POST   /diagrams/:diagramId/duplicate       # Duplicar diagrama
POST   /diagrams/:diagramId/move            # Mover para outro folder/projeto
```

#### Diagram Versions
```
POST   /diagrams/:diagramId/versions        # Salvar nova versão
       Body: { snapshot, nodeLayouts, edgeLayouts, viewport, scenes, message? }

GET    /diagrams/:diagramId/versions        # Listar versões (paginado)
       ?page=1&limit=20

GET    /diagrams/:diagramId/versions/:versionId  # Obter versão específica
POST   /diagrams/:diagramId/versions/:versionId/restore  # Restaurar versão
```

#### Tags
```
GET    /workspaces/:wId/tags                # Listar tags
POST   /workspaces/:wId/tags                # Criar tag
PATCH  /tags/:tagId                         # Atualizar tag
DELETE /tags/:tagId                         # Deletar tag
POST   /diagrams/:diagramId/tags            # Adicionar tags ao diagrama
DELETE /diagrams/:diagramId/tags/:tagId     # Remover tag do diagrama
```

### 6.2 Formato de Resposta

```json
// GET /diagrams/:id (resposta completa)
{
  "id": "uuid",
  "name": "Sistema de Pagamentos",
  "description": "...",
  "level": "container",
  "domain": "payments",
  "folderId": "uuid | null",
  "currentVersion": {
    "id": "uuid",
    "versionNumber": 12,
    "snapshot": { /* ModelDraft */ },
    "nodeLayouts": { /* ... */ },
    "edgeLayouts": { /* ... */ },
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "scenes": { /* ... */ },
    "createdAt": "2026-05-15T10:30:00Z"
  },
  "tags": [{ "id": "uuid", "name": "production", "color": "#22c55e" }],
  "createdAt": "2026-01-10T08:00:00Z",
  "updatedAt": "2026-05-15T10:30:00Z"
}

// GET /projects/:pId/diagrams (listagem — sem snapshot)
{
  "data": [
    {
      "id": "uuid",
      "name": "...",
      "level": "context",
      "domain": "...",
      "folderId": "uuid",
      "versionCount": 12,
      "componentCount": 23,   // derivado do snapshot
      "updatedAt": "...",
      "tags": [...]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 47
  }
}
```

### 6.3 Considerações

- **Listagem sem snapshot:** A listagem de diagramas não retorna o snapshot completo — seria muito pesado. Campos derivados como `componentCount` podem ser cacheados no `diagrams` table ou computados via subquery JSONB.
- **Autosave:** O frontend pode debouncar saves (ex.: 5-10s de inatividade) e chamar `POST /diagrams/:id/versions`. O backend decide se cria nova versão ou não (ex.: hash do snapshot idêntico = skip).

---

## 7. Integração com o Frontend

### 7.1 Camada de Abstração Proposta

```
┌────────────────────────────────────┐
│          React Components          │  Nunca chamam API diretamente
├────────────────────────────────────┤
│         Zustand Store              │  Único ponto de mutação
│    (diagram.store + slices)        │
├────────────────────────────────────┤
│       DiagramRepository            │  Interface — escolhe storage
│  ┌──────────┐  ┌────────────────┐  │
│  │  Local    │  │    Remote      │  │
│  │ Storage   │  │  (API Client)  │  │
│  │ Adapter   │  │                │  │
│  └──────────┘  └────────────────┘  │
└────────────────────────────────────┘
```

### 7.2 Evolução do IStoragePort

O frontend já possui uma interface `IStoragePort`:

```typescript
export interface IStoragePort {
  save(key: string, data: unknown): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
```

Essa interface é o ponto de extensão natural. Caminhos:

1. **Criar `ApiStorageAdapter` que implementa `IStoragePort`:**
   - Simples, mas limita a API a key-value (perde paginação, filtros, versioning).
   - Serve como primeiro passo, não como solução final.

2. **Criar interface `DiagramRepository` de nível mais alto (recomendado):**

```typescript
interface DiagramRepository {
  listDiagrams(projectId: string, filters: ListFilters): Promise<PaginatedResult<DiagramSummary>>;
  getDiagram(diagramId: string): Promise<Diagram>;
  saveDiagram(diagram: Diagram): Promise<DiagramVersion>;
  deleteDiagram(diagramId: string): Promise<void>;
  archiveDiagram(diagramId: string): Promise<void>;
  duplicateDiagram(diagramId: string, name: string): Promise<Diagram>;
  listVersions(diagramId: string, page: number): Promise<PaginatedResult<VersionSummary>>;
  restoreVersion(diagramId: string, versionId: string): Promise<Diagram>;
  // folders, projects, etc.
}
```

Com implementações:
- `LocalDiagramRepository` — usa localStorage/FileSystem (modo offline)
- `RemoteDiagramRepository` — usa API REST
- `HybridDiagramRepository` — local-first com sync

### 7.3 Pontos do Zustand que Precisariam Ser Adaptados

| Ponto | Arquivo | Mudança |
|-------|---------|---------|
| **Hidratação inicial** | `diagram.store.ts`, `persist.config.ts` | Em modo remoto, hidratar de API ao invés de localStorage. Listar diagramas com metadata-only, carregar snapshot on-demand ao abrir. |
| **Save/persist** | `persist.config.ts`, `wrapIStoragePortWithDiagramPersistTracking` | Debounce para API com backoff em caso de falha. Feedback de save no `useSaveStatusStore`. |
| **addDiagram** | `diagram.slice.ts` | Chamar API para criar, usar ID retornado pelo backend. |
| **deleteDiagram** | `diagram.slice.ts` | Chamar API para archive, remover do store local. |
| **importDiagram** | `diagram.slice.ts` | Upload do JSON para API. |
| **duplicateDiagram** | `diagram.slice.ts` | Chamar endpoint de duplicação. |
| **Dashboard listing** | `src/pages/dashboard/index.tsx` | Fetch paginado de API, loading/error states, search server-side. |
| **Diagram open** | `openDiagram` em `diagram.slice.ts` | Fetch do snapshot completo da API ao abrir. |

### 7.4 Modo Local/Offline

**A experiência local-first deve ser preservada.** Proposta:

1. **Modo local (padrão):** Funciona exatamente como hoje. Nenhuma dependência de backend.
2. **Modo cloud:** Requer autenticação. Diagrams são sincronizados com API.
3. **Detecção automática:** Se o usuário está logado e online, usa modo cloud. Se offline, faz fallback para cache local com sync ao reconectar.
4. **Migração de dados:** Ao conectar pela primeira vez, oferecer "Import existing local diagrams to cloud".

### 7.5 Princípio: Componentes React Nunca Chamam API

- Toda interação passa pelo Zustand store (já é o caso hoje).
- O store decide se chama `LocalDiagramRepository` ou `RemoteDiagramRepository`.
- Componentes React ficam inalterados (ou com mudanças mínimas, como loading states).

---

## 8. Riscos e Trade-offs

### 8.1 Riscos Técnicos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **JSONB vs normalizado** | Queries complexas sobre conteúdo do snapshot são lentas | Índice GIN + campos derivados na tabela `diagrams` (ex: `component_count`) |
| **Tamanho do snapshot** | Diagramas muito grandes (>1MB) impactam latência de save/load | Compressão na transferência (gzip), lazy loading de campos pesados (flows, iconLibrary) |
| **Conflitos de sync** | Dois devices editando o mesmo diagrama geram conflitos | Last-write-wins para MVP; lock otimista (version check) no save; CRDT/OT para futuro |
| **Migração de dados** | Schema do snapshot evolui no frontend; backend precisa acompanhar | Manter `schemaVersion` no snapshot; migrações client-side (como já existe); backend aceita qualquer versão válida |
| **Autenticação** | Adicionar auth ao frontend muda o fluxo de UX | Manter modo anônimo/local como opção; auth opcional para cloud |

### 8.2 Trade-offs Aceitos

| Decisão | Trade-off |
|---------|-----------|
| Snapshot completo por versão | Mais storage, mas simplicidade e restore instantâneo |
| JSONB para snapshot | Queries internas limitadas, mas match perfeito com o formato do frontend |
| Hierarquia Workspace > Project > Folder | Mais complexo que flat, mas escala melhor para times |
| `current_version_id` como ponteiro | FK circular, mas evita query "MAX(version_number)" em toda leitura |

---

## 9. Plano Incremental de Implementação

### Fase 0 — Setup (fundação)
- Criar projeto NestJS com TypeORM, PostgreSQL.
- Configurar linting, testing (Jest), CI.
- Implementar `DatabaseModule` com migrations.
- Implementar `AuthModule` básico (email/password + JWT).

### Fase 1 — CRUD de Diagramas (MVP mínimo)
- Implementar entidades: `User`, `Workspace` (auto-create), `Project` (auto-create), `Diagram`, `DiagramVersion`.
- Endpoints: criar diagrama, salvar versão, obter diagrama com snapshot, listar diagramas (sem paginação inicialmente).
- Frontend: criar `RemoteDiagramRepository`, toggle local/cloud.
- **Entregável:** Salvar e recuperar diagramas via API.

### Fase 2 — Inventário e Navegação
- Paginação na listagem de diagramas.
- Filtros: level, domain, search.
- Implementar `FoldersModule` com CRUD e hierarquia.
- Tags e metadata.
- Dashboard do frontend adaptado para fetch remoto.
- **Entregável:** Dashboard funcional com dados do backend.

### Fase 3 — Versionamento
- Listar versões de um diagrama.
- Restaurar versão anterior.
- Comparação visual (diff) entre versões no frontend (computado client-side).
- **Entregável:** Timeline de versões com restore.

### Fase 4 — Colaboração e Multi-user
- Workspace members com roles.
- Projects compartilhados.
- Autenticação OAuth (GitHub).
- **Entregável:** Times trabalhando no mesmo workspace.

### Fase 5 — Sync Offline e Otimizações
- Cache local com sync optimistic.
- Conflict resolution strategy.
- Deduplicação de versões (hash check).
- Compressão de payloads.
- **Entregável:** Experiência offline-first com sync confiável.

---

## Resumo Executivo

O Structura tem uma arquitetura frontend bem estruturada com separação clara entre model, store e UI. A interface `IStoragePort` e o padrão de adapters já existentes (`LocalStorageAdapter`, `FileSystemAdapter`, `InMemoryAdapter`) formam um ponto de extensão natural para integrar um backend.

A estratégia recomendada é:

1. **Snapshot completo por versão** — simples, alinhado com o modelo mental do frontend, storage trivial.
2. **JSONB para o grafo do diagrama** — evita impedance mismatch entre frontend e backend.
3. **Hierarquia Workspace > Project > Folder > Diagram** — escala de individual a times.
4. **Modo dual local/cloud** — preserva a experiência local-first.
5. **Implementação incremental** — MVP focado em CRUD + versioning, features avançadas depois.

O principal risco é a complexidade de sincronização offline, que pode ser mitigada começando com modo cloud-only e adicionando offline na Fase 5.
