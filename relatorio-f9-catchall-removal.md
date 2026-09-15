# Relatório — Fatia F9: fim do catch-all e da lista manual

Branch: `feat/element-registry-f9-catchall-removal`  
Base: `feat/element-registry-f6b-schema-cutover` (ponta da pilha; F9 depende de F3+F5, não de deploy de F6b)

## As duas partes

### Parte 1 — C4 vira família declarada

- Fábrica pequena `buildC4Descriptors()` em `src/features/elements/families/c4/c4.family.ts`.
- Quatro `ElementDescriptor` com `family: "c4"`, sem catálogo, sem `cloudServiceId`.
- Canvas compartilhado: `CustomNode` + `buildCardNodeData` / `buildCardNodeStyle` (mesmo contrato das famílias de nuvem).
- `rfType` distinto por id (`person` / `system` / `container` / `component`) — sem `canvas.variants`.
- **Não** é uma `CloudFamilyDefinition` degenerada (arquitetura §2.3(b)).

### Parte 2 — o catch-all morre de verdade

- Removido `c4Descriptor` / `matches: () => true`.
- `NODE_TYPE_REGISTRY` fica **vazio para builtins** — só plugins via `registerDescriptor`.
- Tipo desconhecido → elemento `unknown` (render + sanitize).
- `BUILTIN_COMPONENT_TYPES` removido; `sanitizeComponentType` consulta `hasElement` + plugin + recuperação de prefixo.

## Recuperação de tipo (mitigação do risco F9)

Antes de cair em `"unknown"`:

1. id no registry → preserva
2. padrão plugin `id/name` → preserva
3. prefixo `aws-` / `gcp-` / `azure-` com categoria inexistente → `*-general` se registrado
4. senão → `"unknown"` (antes era `"component"`)

Não há fuzzy matching além do prefixo de provedor.

## Mudança de comportamento visível

Ver `release-note-f9-unknown-types.md`. Diagramas com `type` corrompido deixam de virar C4 silencioso.

## `RegisteredElementTypeId`

Após F9 a lista explícita cobre **todo** `ComponentType` interno fechado (55 ids: 4 C4 + 10 estruturais + categorias GCP/Azure/AWS).  
`Exclude<ComponentType, PluginComponentType>` seria equivalente, mas perde o espelho auditável por fatia; mantido o literal list + predicado `isRegisteredElementType` até o caminho de plugin sair de `NODE_TYPE_REGISTRY`.

## `NODE_TYPE_REGISTRY`

Não pode ser removido ainda: plugins continuam registrando descriptors nele. Render builtins passa só pelo `elementRegistry` / `getNodeTypesSnapshot()`.

## Baseline de performance (maior salto esperado da série)

Medido em `f9-lookup.baseline.test.ts` nesta máquina:

| Medição                             | Resultado   |
| ----------------------------------- | ----------- |
| `hasElement` × 55 ids × 2000 rounds | **2.96 ms** |
| `getDescriptor("person")` × 50 000  | **2.81 ms** |

C4 deixou de ser o último `matches` num scan linear; lookup é O(1) no mapa do registry.

## Gates

| Gate                                                                   | Resultado                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| `npm run typecheck`                                                    | OK                                                |
| Vitest (elements, node-types, sanitize, migrations, golden, plugins)   | OK                                                |
| `node plugins/structura-plugin-leanix/scripts/sync-shared.mjs --check` | OK (path real do plugin)                          |
| Golden draw.io                                                         | inalterado (serviceName C4 preenchido no adapter) |

## Fora de escopo (intocado)

- Kubernetes / `oss` (F7/F8)
- Rename CustomComponentTemplate / CustomNode (F10)
- Status de deploy de F6b
