# Structura - Mapa Completo de Funcionalidades

## 🎹 Atalhos de Teclado

| Atalho | Ação | Dor que Resolve |
|--------|------|-----------------|
| `Cmd/Ctrl + E` | Quick Insert (menu rápido) | Adicionar elementos sem navegar menus |
| `Cmd/Ctrl + 1` | Adicionar Person | Criar atores rapidamente |
| `Cmd/Ctrl + 2` | Adicionar System | Criar sistemas externos |
| `Cmd/Ctrl + 3` | Adicionar Container | Criar containers |
| `Cmd/Ctrl + 4` | Adicionar Component | Criar componentes |
| `Cmd/Ctrl + F` | Buscar no canvas | Encontrar elementos em diagramas grandes |
| `Cmd/Ctrl + /` | Buscar (alternativo) | Atalho alternativo |
| `Cmd/Ctrl + K` | Command Palette | Acessar qualquer comando |
| `Cmd/Ctrl + B` | Toggle Sidebar | Liberar espaço na tela |
| `Cmd/Ctrl + S` | Salvar na pasta | Sincronizar com pasta conectada |
| `Cmd/Ctrl + A` | Selecionar tudo | Seleção em massa |
| `Cmd/Ctrl + C` | Copiar | Copiar elementos |
| `Cmd/Ctrl + V` | Colar | Colar elementos |
| `Cmd/Ctrl + D` | Duplicar | Duplicar rapidamente |
| `Cmd/Ctrl + G` | Agrupar | Agrupar elementos |
| `Cmd/Ctrl + Shift + G` | Desagrupar | Separar elementos |
| `Cmd/Ctrl + Shift + W` | Resetar waypoints | Restaurar estilo padrão |
| `Cmd/Ctrl + Shift + K` | Toggle Lock | Travar/destravar elementos |
| `Cmd/Ctrl + Z` | Desfazer | Voltar ações |
| `Cmd/Ctrl + Shift + Z` | Refazer | Refazer ações |
| `Cmd/Ctrl + Y` | Refazer (alternativo) | Atalho alternativo |
| `Del / Backspace` | Deletar | Remover elementos |
| `Esc` | Limpar seleção | Desselecionar |
| `← / →` | Fluxo: passo anterior/próximo | Navegar fluxos |

---

## 🎨 Canvas

### Navegação
- **Pan**: Arrastar com mouse/touch
- **Zoom**: Scroll do mouse, pinch
- **Fit to screen**: Ajustar zoom para todo diagrama
- **Minimap**: Visão geral

### Seleção
- Click: selecionar elemento
- Cmd+Click: seleção múltipla
- Arrastar: selecionar área
- Cmd+A: selecionar tudo

### Hooks do Canvas
- `useCanvasKeyboard` - Orquestrador de teclado
- `useCopyPasteShortcuts` - Copy/paste/duplicate
- `useSelectionShortcuts` - Seleção e deleção
- `useUndoRedoShortcuts` - Histórico
- `useGroupShortcuts` - Agrupamento
- `useEdgeWaypointShortcuts` - Waypoints
- `useLockShortcuts` - Travar elementos
- `useRecordingShortcuts` - Navegação de fluxos
- `useNodeDragParenting` - Drag para reparentar
- `useAutoLayout` - Layout automático

---

## 🏗️ Tipos de Componentes

### Níveis C4
| Tipo | Descrição | Quando Usar |
|------|-----------|-------------|
| `person` | Ator/pessoa | Usuários do sistema |
| `system` | Sistema externo | Sistemas fora do contexto |
| `container` | Container/aplicação | Aplicações principal |
| `component` | Componente | Blocos de código |

### Componentes Especiais
| Tipo | Descrição |
|------|-----------|
| `panel` | Painel container (VPC, AZ, etc.) |
| `note` | Nota/lembrete |
| `api-group` | Grupo de APIs |
| `endpoint` | Endpoint individual |
| `db-table` | Tabela de banco |
| `json-viewer` | Visualizador JSON |
| `process-node` | Nó de processo |
| `svg` | SVG customizado |
| `external-element` | Link para outro diagrama |

### Componentes de Cloud
- **AWS**: EC2, S3, Lambda, RDS, etc.
- **GCP**: Compute Engine, Cloud Storage, etc.
- **Azure**: VMs, Blob Storage, Functions, etc.

---

## 🔗 Conexões

### Estilos de Rota
- Bezier (curva suave)
- Smoothstep
- Step
- Straight (reta)
- Editable (editável com waypoints)
- EditableStep

### Estilos de Linha
- Sólida
- Tracejada (dashed)
- Pontilhada (dotted)

### Marcadores
- Nenhum
- Seta
- Seta fechada

### Intenções de Conexão
- `dependency` - Dependência
- `call` - Chamada síncrona
- `event` - Evento
- `data-flow` - Fluxo de dados
- `async-message` - Mensagem assíncrona

### Direções
- Unidirecional
- Bidirecional
- Reverse

---

## 🌊 Fluxos (Flow Recording)

### Funcionalidades
- **Gravar fluxos**: Registrar sequências de ações
- **Playback**: Reproduzir visualmente
- **Steps**: Cada passo com highlight
- **Conditions**: Passos condicionais com branches
- **Mermaid**: Exportar como diagrama de sequência

### Tipos de Fluxo
| Tipo | Uso |
|------|-----|
| Action | Passo básico |
| Condition | Branch com label |
| Note | Anotação |

### Mermaid Integration
- `parseMermaidFlowchart` - Parse flowchart
- `parseMermaidSequence` - Parse sequência
- `stepsToMermaid` / `parseMermaidToSteps` - Conversão bidirecional

### Problema que Resolve
- Documentar fluxos manualmente é tedioso
- Fluxos ficam desatualizados
- Dificuldade de visualizar sequências

---

## 🎭 Cenários (Scenes)

### Funcionalidades
- **Múltiplas views**: Vários snapshot do mesmo diagrama
- **Diff mode**: Comparar cenas
- **Viewport snapshots**: Cada cena lembra o zoom/posição
- **Merge dialogs**: Resolver conflitos

### Problema que Resolve
- Diagramas muito carregados
- Diferentes perspectivas do mesmo sistema
- Animações para apresentações

---

## 📤 Compartilhamento

### Formatos de Export
| Formato | Uso | Quando Usar |
|---------|-----|-------------|
| JSON | Backup completo | Re-importar, versionar |
| Draw.io | Editores visuais | diagrams.net, Lucidchart |
| Mermaid | Documentação | Markdown, GitHub |

### Compartilhamento via URL
- **Shared preview**: Link para visualizar
- **LZ-string compression**: URL curta
- **PostMessage API**: Embedding em iframes

### Problema que Resolve
- JSON por email/chat é desajeitado
- URL muito longa
- Compartilhar sem perder formatação

---

## 💾 Storage / Persistência

### Adaptadores
| Método | Armazenamento | Uso |
|--------|---------------|-----|
| LocalStorage | Browser | Backup automático |
| FileSystem | Pasta do usuário | OneDrive, iCloud, etc. |
| InMemory | Memória | Testing |

### Funcionalidades
- **Auto-save**: Salva automaticamente
- **Sync**: Bidirecional com pasta
- **Conflict resolution**: UI para conflitos
- **Storage warning**: Alerta de quota

### Problema que Resolve
- Perda de trabalho
- Sincronização entre dispositivos
- Backup antes de mudanças

---

## 👥 Colaboração em Tempo Real

### Funcionalidades
- **CollabProvider**: Provider de contexto
- **Remote cursors**: Ver onde outros estão
- **Peer presence**: Indicador de presença
- **Conflict warning**: Alerta de edição simultânea
- **Room management**: Gerenciamento de salas

### Status
- idle, connecting, connected, reconnecting, disconnected, closed

### Problema que Resolve
- Pair programming em arquitetura
- Revisão em reunião
- Consistência em equipes

---

## 📦 Service Catalog

### Funcionalidades
- Catálogo de serviços
- Fontes: GitHub, DefectDojo, Manual
- Service linking com componentes
- Detecção automática

### Definição de Serviço
- Nome, descrição, repositório
- Technology stack
- Owner, tags
- Service ID linking

### Integrações
- GitHub: Import de repositórios
- DefectDojo: Import de produtos

### Problema que Resolve
- Lista de serviços desatualizada
- Notações diferentes em contextos
- Ícones padronizados

---

## 🧩 Custom Components

### Sistema de Templates
- `CustomComponentTemplate` - Definição
- CRUD operations no store
- `SaveCustomComponentModal` - Salvar template

### Icon Library
- Lucide icons
- AWS icons
- Custom icons
- `IconPickerModal` - Seletor de ícones

### Problema que Resolve
- Componentes repetitivos
- Padronização na equipe
- Ícones da empresa

---

## 🤖 LLM Integration

### Funcionalidades
- Chat panel com assistente
- Análise de diagramas
- Mention picker (@-mention)
- Sugestões contextuais
- Geração de catálogo

### Componentes
- `ChatPanel` - Painel de chat
- `MentionInput` - Input com mentions
- LLM settings management

### Problema que Resolve
- Explicar decisões de design
- Documentação automática
- Análise de diagramas existentes

---

## 🔌 Plugin System

### Capabilities
- `canvas:node-types` - Tipos de nó customizados
- `io:importers` - Importadores customizados
- `io:exporters` - Exportadores customizados
- `ui:panels` - Painéis customizados
- `events:diagram` - Eventos de mudança
- `diagram:read/write` - Ler/escrever diagrama
- `storage` - Storage persistente
- `network` - Requisições HTTP

### API do Plugin
```javascript
registerNodeType()    // Registrar tipo de nó
registerExporter()     // Registrar exportador
registerImporter()     // Registrar importador
registerPanel()       // Registrar painel
onDiagramChange()      // Subscrever mudanças
getActiveDiagramId()   // ID do diagrama ativo
getDiagram()          // Ler snapshot
updateComponent()     // Patch componentes
moveComponents()      // Mover em lote
```

### IO Registry
- `findImportersForFile()` - Encontrar importadores

### Problema que Resolve
- Formatos específicos de ferramentas
- Workflows customizados
- Integrações com outras ferramentas

---

## ⌘ Command Palette

### Funcionalidades
- Fuzzy search
- Comandos organizados por categoria
- Recentes
- Atalhos mostrados

### Componentes
- `DiagramCommandPalette` - Paleta principal
- `CommandShortcut` - Componente de atalho

### Problema que Resolve
- Menus com muitas opções
- Funcionalidades escondidas
- Curva de aprendizado longa

---

## 🔍 Buscar e Localizar

### Funcionalidades
- Busca global
- Filtros por tipo/nível/nome
- Highlight visual
- Navegação direta

### Componentes
- `CanvasSearch` - Busca no canvas
- Fuzzy matching

### Problema que Resolve
- Diagramas grandes
- Encontrar elementos específicos
- Auditar componentes

---

## 📊 Versionamento e Histórico

### Funcionalidades
- **Undo/Redo**: Histórico de ações
- **Flow repair**: Reparo de fluxos quebrados
- **Flow migration**: Migração de fluxos
- **Flow duplication**: Duplicação de fluxos

### Hooks
- `useUndoRedoShortcuts` - Atalhos de histórico

### Problema que Resolve
- Experimentar sem medo
- Ver o que mudou
- Recuperar trabalho perdido

---

## 🌙 UI/UX

### Temas
- Dark mode
- Light mode

### Modos
- **Focus Mode**: Máximo espaço para diagrama
- **Compare Mode**: Comparar cenas

### Responsividade
- Adaptado para diferentes telas
- Mobile: read-only

### Componentes UI
- Dialog, AlertDialog, Popover
- Button, Input, Textarea, Select
- Checkbox, Switch, Tabs
- Tooltip, DropdownMenu
- Card, Badge, Separator
- Command palette

---

## 📐 Patterns

### Funcionalidades
- Pattern picker
- Bookmarks de padrões
- Categorias organizadas

### Componentes
- `PatternPicker` - Seletor de padrões
- `Bookmark` - Padrão salvo

### Problema que Resolve
- Reutilizar designs comuns
- Padronizar na equipe
- Economizar tempo

---

## ☁️ Cloud Providers

### Providers
- **AWS**: EC2, S3, Lambda, RDS, ECS, EKS, etc.
- **GCP**: Compute Engine, Cloud Storage, Cloud Functions, etc.
- **Azure**: VMs, Blob, Functions, AKS, etc.

### Registry
- `CloudProviderRegistry` - Registro de providers

### Problema que Resolve
- Ícones padronizados
- Categorização correta
- Visual consistente

---

## 📋 Resumo por Problema

| Problema | Solução |
|----------|---------|
| "Não sei por onde começar" | Command Palette, Quick Insert, Patterns |
| "Diagrama muito grande" | Scenes, Buscar, Minimap, Fit |
| "Não consigo explicar o fluxo" | Flow Recording, Playback, Mermaid |
| "Preciso mostrar para meu chefe" | Levels C4, Compartilhamento, Embed |
| "Equipe não entende" | Notes, Labels |
| "Perco meu trabalho" | Auto-save, FileSystem sync, Export |
| "Várias pessoas editando" | Colaboração em tempo real |
| "Cansado de repetir" | Templates, Custom Components, Patterns |
| "Não encontro nada" | Busca global, Minimap |
| "Quero dokumentar fluxos" | Flow Recording, Mermaid export |
| "Preciso mostrar a arquitetura" | Níveis C4, Compartilhamento |
| "Tenho medo de errar" | Undo/Redo, Lock, Save |
