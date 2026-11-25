# Design

## One arranger

The embed bundles the app, so it can run `planDiagramAutoLayout` itself.

`src/embed/arrange.ts` builds the preview diagram as today, with stable ids: the component `key`
and the connection key. It then loads that diagram into a throwaway in-memory store, plans with
the received settings, and applies the plan to that store:

- positions and references through `applyAutoLayout`;
- handle order and corridors through `applyLayoutResultEdges`.

Both helpers default to the app store and now accept another one.

Because the connection ids are fixed before arranging, a connection moved onto a reference keeps
its id. Only its `targetId` changes. Reference ids are generated, like the canvas does.

The extension sends settings as received. The embed normalises them with
`normalizeLayoutSettings`, so the extension's menu bounds only affect what can be picked, not what
is trusted.

## Stability

The canvas re-arranges only after a structural edit. The embed mirrors that with a signature made
of:

- each component's id, parent, type and size;
- each connection's id and ends;
- the normalised settings.

When the signature has not changed (a description or technology edit), the previous arranged
picture is kept. The fresh content is patched in:

- components take their new fields, and an original keeps the `shared` mode its references gave it;
- references take their original's name;
- connections keep the ends the arrangement gave them.

Anything else re-arranges. The canvas pipeline is deterministic, so re-arranging the same
structure gives the same picture.

## Protocol

```
host → embed  STRUCTURA_LOAD_GRAPH { components, connections, arrange? }
host → embed  STRUCTURA_ARRANGE { arrange }
arrange = { mode: "automatic" | "manual", settings?: DiagramLayoutSettings }
```

An absent or malformed `arrange` on `LOAD_GRAPH` keeps the current one. The embed starts in manual
mode, so hosts that post positions are unchanged.

An arrangement that fails draws the host's positions. A late arrangement result is dropped when a
newer graph arrived meanwhile.

## Extension

`extensions/vscode-opscr/src/arrange.ts` (pure, unit-tested):

- `ArrangeSettings`;
- the defaults;
- the mirrored bounds;
- the menu labels;
- the message the preview posts.

`extension.ts` owns:

- the QuickPick (`opscr.arrangePreview`);
- `workspaceState` (`opscr.arrange:<folder>`);
- the status bar item.

Every choice posts `STRUCTURA_ARRANGE` at once, and every `LOAD_GRAPH` carries the current
`arrange`.

- In manual mode the host pipeline (ELK copy, stable placement, sidecar) keeps running as before.
- In automatic mode the host still compiles and places, because `toImporterGraph` needs positions,
  but the embed ignores them.

## Webview and ELK

The canvas runs ELK in a Web Worker. The webview's CSP has no `worker-src`, and a worker cannot be
built from the webview's resource origin. `runElk` already falls back to ELK on the main thread
when the worker is unavailable. The arrangement runs there, off the host's thread.
