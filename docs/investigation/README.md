# Investigation logs

Dated engineering logs from performance and rendering investigations. Each one records what was
measured, read in the code or hypothesized during a session, and the fix that followed.

- They are **written in Portuguese** (the language the sessions were run in). An English
  translation is welcome as a contribution.
- They are kept because source comments cite them by section (for example
  `docs/investigation/divergencia-edicao-visualizacao.md §3.5`). Renaming or deleting one breaks
  those references.
- They describe the code **as it was at the commit they name**, not the current code. For current
  behavior, read [../concepts/](../concepts/); when a log and the code disagree, the code wins.

| Log | Topic |
| --- | --- |
| [edge-relayer.md](edge-relayer.md) | Edge layer unmount/remount on drag commit |
| [divergencia-edicao-visualizacao.md](divergencia-edicao-visualizacao.md) | Rendering divergences between the editor and the viewer |
| [paridade-editor-viewer-caixa-do-no.md](paridade-editor-viewer-caixa-do-no.md) | Editor/viewer parity: the node box |

Related logs elsewhere in `docs/`: [../epico-virtualizacao/](../epico-virtualizacao/) (canvas
virtualization and the post-drag commit loop), [../epico-layout-visualization/](../epico-layout-visualization/)
(layout quality and the viewer foundation), [../discovery/](../discovery/) (file-system
persistence instability) and [../collab-entity-patches.md](../collab-entity-patches.md)
(per-entity patches in the collaboration relay).
