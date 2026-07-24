# Bug: draw.io export — edges cortando por dentro de nós e âncoras erradas

## Problema

O export draw.io do Structura apresentava dois bugs relacionados:

1. **Edges cortando por dentro de outros nós**: a edge S3→Glue no diagrama AWS passava por dentro do nó EC2 (que fica entre eles).
2. **Edges não saindo pelo lado correto**: edges horizontais saíam por baixo ou por cima em vez de pela direita (source) e esquerda (target).

---

## Investigação — 3 Perguntas

### 1. Waypoints existem no pipeline pós-unificação (Fase 0-2)?

**Sim.** O pipeline está intacto:

```
edgeLayouts[connId].points (EdgeControlPoint[])
  → mapEdge() em to-export-model.ts
    → ExportEdge.waypoints: {x, y}[]
      → build.ts transformCanvasPoint()
        → <mxPoint> no XML
```

Os waypoints **não foram perdidos** na reescrita do export-core.

### 2. `orthogonalEdgeStyle` ignora `<Array as="points">`?

**Não.** O draw.io/osmx usa waypoints como restrições de roteamento. Exemplo real no snapshot: edge e5 tem `edgeStyle=orthogonalEdgeStyle` + `<Array as="points"><mxPoint x="680" y="400"/></Array>` — ambos coexistem.

### 3. Por que S3→Glue cortava o EC2 mesmo com `orthogonalEdgeStyle`?

**Causa real**: S3 e Glue compartilham um container ancestral (panel/AWS). Outros siblings (EC2) ficam entre elas. O routing automático do draw.io não conhece esses obstáculos — e **não havia waypoints manuais** para o router seguir. O resultado: linha reta passando por dentro do EC2.

---

## Primeira Tentativa de Fix

Adicionei `buildContainerWaypoints()` em `to-export-model.ts` para sintetizar waypoints automaticamente quando source e target são siblings dentro do mesmo container.

**Bug nessa primeira versão**: o código adicionava waypoints para **qualquer** edge com siblings no container, mesmo quando o caminho direto não intersectava nenhum nó. Resultado: edges simples (Lambda→EC2) ganhavam waypoints desnecessários e saíam pelo lado errado.

---

## Correção Final

A função agora só adiciona waypoints quando **o caminho direto é de fato bloqueado** — verificado por testes de interseção:

```typescript
// Banda horizontal (y = midY, x de source→target) intersecta alguma box?
function hBandBlocked(a, b, midY): boolean {
  for (const box of occupiedBoxes) {
    if (box.y <= midY && midY <= box.y + box.h) {
      if (Math.max(a, box.x) < Math.min(b, box.x + box.w)) return true;
    }
  }
  return false;
}

// Banda vertical (x = midX, y de source→target) intersecta alguma box?
function vBandBlocked(a, b, midX): boolean { ... }
```

Lógica por direção:

| Caso | Condição | Ação |
|------|----------|------|
| Target à direita | `sRight < tLeft` | Se `hBandBlocked` → waypoints abaixo dos obstáculos |
| Target à esquerda | `tLeft < sRight` | Se `hBandBlocked` → waypoints acima dos obstáculos |
| Target abaixo | `sMidY < tMidY` | Se `vBandBlocked` → waypoints à direita dos obstáculos |
| Target acima | `tMidY < sMidY` | Se `vBandBlocked` → waypoints à esquerda dos obstáculos |

Waypoints de **usuário editados manualmente** sempre têm prioridade (o e5 do snapshot não é afetado).

---

## Artefato "n]"

O artefato "n]" que aparece sobreposto ao texto "AWS Glue" **não está relacionado** às mudanças de âncora/waypoints. É um bug separado de renderização de label (provavelmente um caracter escapado incorretamente no XML do draw.io).

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/export-service/to-export-model.ts` | `buildContainerWaypoints()` com interseção + `mapEdge()` com `components` param |
| `src/lib/export-core/build.test.ts` | Comentários atualizados sobre `orthogonalEdgeStyle` |
| `src/lib/export-core/styles.ts` | `orthogonalEdgeStyle` como default (antes: `elbowEdgeStyle`) |
| `src/lib/export-core/model.ts` | Comentários JSDoc sobre âncoras |
| `src/lib/export-core/edge-builder.ts` | Comentários sobre anchors |
| `plugins/structura-plugin-leanix/src/generated/export-core/*` | Sync automático |

---

## Validação

- ✅ 15/15 testes `export-service`
- ✅ 12/12 testes `export-core/build.test.ts`
- ✅ LeanIX plugin sync — 11 arquivos

---

## Commits

- `7da40e3` — feat: geometry-inferred anchors + orthogonal routing para flows verticais
- `ddb78b0` (amend) — feat: container-aware waypoints (primeira versão, com bug)
- `c16152a` (amend) — **fix: collision-aware waypoints** (versão final com interseção)
