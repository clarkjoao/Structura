# element-pack

**Capabilities:** `canvas:elements` (Plugin API 1.17)

Adds an "Edge Platform" group to the element catalog:

- two catalog services, drawn as cards with an icon and a category accent — the same format as
  the host's built-in packs (`src/features/elements/packs/<id>/pack.json`), with the icons given
  as SVG markup (the host sanitizes them);
- one SVG shape, "Hexagon tile" (`registerShape`), stretched to the node with its name inside.

Disabling the plugin removes the group; nodes already on a diagram show as unknown, with their
data kept, until it is enabled again.

**Files:**

- `plugin.js` — The plugin (upload this)
- `README.md` — This file
