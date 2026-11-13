# Design

**Monaco rename provider per editor.** Monaco registers rename providers per language for every
editor; the host registers one per plugin editor whose callbacks return null for any other model,
which makes Monaco ask the next provider. Where the plugin has no symbol, the provider rejects
with a localized "Nothing here can be renamed". The edits returned to Monaco are empty: the plugin
changes its own buffers (possibly several files) and the editor follows its `value`.

**opscr rename = canvas rename, started from the text.** The pane runs it in the sync queue:
reconcile pending canvas edits, `renameElement` over every manifest, `renameInBinding` (keys,
children's identity, connection keys, signature name), then one canvas update of the name and a
sync, which finds nothing else to change.
